

from __future__ import annotations

import argparse
import shutil
import sys
import time
from datetime import datetime
from pathlib import Path

from ultralytics import YOLO


SUPPORTED_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}
DEFAULT_NEW_DIR = Path("data") / "new annotations"
TRAIN_IMAGES_DIR = Path("data") / "train" / "images"
TRAIN_LABELS_DIR = Path("data") / "train" / "labels"
TRAIN_CACHE_FILE = Path("data") / "train" / "labels.cache"
MODEL_PATH = Path("runs") / "segment" / "transformer_fault_best" / "weights" / "best.pt"


def ensure_directory(path: Path) -> None:
    """Create directory if it does not yet exist."""
    path.mkdir(parents=True, exist_ok=True)


def gather_new_samples(new_dir: Path) -> list[tuple[Path, Path]]:
    """Return list of (image_path, label_path) pairs found inside data/new."""
    images_dir = new_dir / "images"
    labels_dir = new_dir / "labels"
    ensure_directory(images_dir)
    ensure_directory(labels_dir)

    samples: list[tuple[Path, Path]] = []
    skipped_images = 0

    for image_path in images_dir.iterdir():
        if not image_path.is_file():
            continue

        if image_path.suffix.lower() not in SUPPORTED_IMAGE_SUFFIXES:
            skipped_images += 1
            continue

        label_path = labels_dir / f"{image_path.stem}.txt"

        if not label_path.exists():
            print(f"Warning: missing label for {image_path.name}; skipping")
            continue

        samples.append((image_path, label_path))

    if skipped_images:
        print(f"Skipped {skipped_images} files with unsupported extensions")

    return samples


def unique_destination(dest_path: Path) -> Path:
    """Return a non-colliding destination path."""
    if not dest_path.exists():
        return dest_path

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    candidate = dest_path.with_name(f"{dest_path.stem}_{timestamp}{dest_path.suffix}")
    counter = 1

    while candidate.exists():
        candidate = dest_path.with_name(
            f"{dest_path.stem}_{timestamp}_{counter}{dest_path.suffix}"
        )
        counter += 1

    return candidate


def move_samples_to_train(samples: list[tuple[Path, Path]]) -> None:
    """Move the collected samples into the training split."""
    ensure_directory(TRAIN_IMAGES_DIR)
    ensure_directory(TRAIN_LABELS_DIR)

    for image_path, label_path in samples:
        target_image = unique_destination(TRAIN_IMAGES_DIR / image_path.name)
        target_label = unique_destination(TRAIN_LABELS_DIR / label_path.name)

        shutil.move(str(image_path), target_image)
        shutil.move(str(label_path), target_label)

        print(f"Moved {image_path.name} -> {target_image.name}")

    # Remove cached label index so YOLO rebuilds it with the new files.
    if TRAIN_CACHE_FILE.exists():
        TRAIN_CACHE_FILE.unlink()
        print("Removed train label cache to force refresh")


def load_model(device: str) -> YOLO:
    """Load the model used for fine-tuning, preferring the latest trained weights."""
    if MODEL_PATH.exists():
        print(f"Loading base weights from {MODEL_PATH}")
        return YOLO(str(MODEL_PATH))

    print("Base weights not found; using yolov8x-seg.pt")
    return YOLO("yolov8x-seg.pt")


def run_finetune(epochs: int, device: str, batch: int) -> None:
    """Launch fine-tuning with moderate hyperparameters suited for incremental updates."""
    model = load_model(device)
    run_name = f"finetune_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    print("\n==============================================================")
    print("Starting fine-tuning on augmented training set")
    print("==============================================================")

    results = model.train(
        data="data/data.yaml",
        epochs=epochs,
        patience=max(20, epochs // 2),
        imgsz=640,
        batch=batch,
        optimizer="AdamW",
        lr0=0.0001, #lower learning rate
        lrf=0.01,
        momentum=0.937,
        weight_decay=0.0005,
        warmup_epochs=min(3, max(1, epochs // 10)),
        warmup_momentum=0.8,
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        translate=0.1,
        scale=0.3,
        shear=0.0,
        perspective=0.0,
        flipud=0.0,
        fliplr=0.5,
        mosaic=0.5,
        mixup=0.0,
        copy_paste=0.0,
        device=device,
        project="runs/segment",
        name=run_name,
        exist_ok=True,
        val=True,
        plots=True,
        verbose=True,
        seed=42,
        deterministic=True,
        cos_lr=True,
        close_mosaic=min(10, max(1, epochs // 5)),
        amp=True,
        fraction=1.0,
        save=True,
        save_period=5,
    )

    print("\n==============================================================")
    print("Fine-tuning complete")
    print("==============================================================")
    print(f"Run directory: runs/segment/{run_name}")

    if hasattr(results, "metrics") and getattr(results.metrics, "results_dict", None):
        metrics = results.metrics.results_dict
        print("\nKey metrics (validation):")
        for key in ("metrics/seg/mAP50", "metrics/seg/mAP50-95", "metrics/seg/precision", "metrics/seg/recall"):
            if key in metrics:
                print(f"  {key}: {metrics[key]:.4f}")


def main(args: argparse.Namespace) -> int:
    new_dir = Path(args.new_dir)

    print(
        f"Watching {new_dir} for new labeled samples "
        f"(poll every {args.poll_interval:.5f}s). Press Ctrl+C to stop."
    )

    try:
        while True:
            samples = gather_new_samples(new_dir)

            if samples:
                print(f"\nFound {len(samples)} new labeled images. Moving to training split...")
                move_samples_to_train(samples)

                if args.move_only:
                    print("Move-only flag set; skipping fine-tuning.")
                else:
                    run_finetune(epochs=args.epochs, device=args.device, batch=args.batch)

                # Continue watching immediately after processing the batch.
                continue

            time.sleep(args.poll_interval)
    except KeyboardInterrupt:
        print("\nStopping watcher.")

    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Move new image/label pairs into the training set and fine-tune the model."
    )
    parser.add_argument("--new-dir", type=str, default=str(DEFAULT_NEW_DIR), help="Directory that holds new samples")
    parser.add_argument("--epochs", type=int, default=50, help="Number of fine-tuning epochs")
    parser.add_argument("--device", type=str, default="cuda", choices=["cuda", "cpu"], help="Computation device")
    parser.add_argument("--batch", type=int, default=8, help="Batch size for fine-tuning")
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=5.0,
        help="Seconds between checks for new samples",
    )
    parser.add_argument(
        "--move-only",
        action="store_true",
        help="Only move the data into the training split without launching fine-tuning",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    cli_args = parse_args(sys.argv[1:])
    sys.exit(main(cli_args))
