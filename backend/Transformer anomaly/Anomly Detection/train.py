"""
Transformer Fault Detection - Training Script
Optimized for maximum accuracy on the dataset (overfitting allowed)
"""

from ultralytics import YOLO
import torch

def train_model():
    """
    Train YOLOv8 segmentation model with settings optimized for best accuracy
    """
    
    # Check if CUDA is available
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"Using device: {device}")
    
    # Load a pretrained YOLOv8 segmentation model (safe loader with fallback)
    # Using yolov8x-seg (largest) for best accuracy
    try:
        model = YOLO('yolov8x-seg.pt')  # Try local file first
    except Exception as e:
        print("⚠️ Failed to load local 'yolov8x-seg.pt' (may be corrupted). Error:", e)
        print("➡️ Falling back to auto-download using model name 'yolov8x-seg'. This requires internet access.")
        model = YOLO('yolov8x-seg')
    
    print("\n" + "="*60)
    print("Starting Training - Transformer Fault Detection")
    print("="*60 + "\n")
    
    # Train with settings optimized for maximum accuracy
    results = model.train(
        # Data configuration
        data='data/data.yaml',
        
        # Training duration - more epochs for better accuracy
        epochs=300,                    # High number of epochs
        patience=100,                  # High patience to avoid early stopping
        
        # Image and batch settings
        imgsz=640,                     # Image size
        batch=1,                       # Adjust based on your GPU memory
        
        # Optimization settings for best accuracy
        optimizer='AdamW',             # AdamW optimizer
        lr0=0.001,                     # Initial learning rate
        lrf=0.01,                      # Final learning rate factor
        momentum=0.937,                # Momentum
        weight_decay=0.0005,           # Weight decay
        warmup_epochs=5,               # Warmup epochs
        warmup_momentum=0.8,           # Warmup momentum
        
        # Augmentation (moderate to preserve data characteristics)
        hsv_h=0.015,                   # HSV-Hue augmentation
        hsv_s=0.7,                     # HSV-Saturation augmentation
        hsv_v=0.4,                     # HSV-Value augmentation
        degrees=0.0,                   # Rotation (disabled for precision)
        translate=0.1,                 # Translation
        scale=0.5,                     # Scale augmentation
        shear=0.0,                     # Shear (disabled)
        perspective=0.0,               # Perspective (disabled)
        flipud=0.0,                    # Vertical flip probability
        fliplr=0.5,                    # Horizontal flip probability
        mosaic=1.0,                    # Mosaic augmentation
        mixup=0.0,                     # Mixup augmentation
        copy_paste=0.0,                # Copy-paste augmentation
        
        # Model saving
        save=True,                     # Save checkpoints
        save_period=10,                # Save every 10 epochs
        
        # Output settings
        project='runs/segment',        # Project directory
        name='transformer_fault_best', # Experiment name
        exist_ok=True,                 # Overwrite existing
        
        # Performance settings
        device=device,                 # Device to use
        workers=8,                     # Number of worker threads
        
        # Validation settings
        val=True,                      # Validate during training
        plots=True,                    # Create plots
        
        # Other settings
        verbose=True,                  # Verbose output
        seed=42,                       # Random seed for reproducibility
        deterministic=True,            # Deterministic mode
        single_cls=False,              # Multiple classes
        rect=False,                    # Rectangular training
        cos_lr=True,                   # Cosine learning rate scheduler
        close_mosaic=10,               # Disable mosaic in last N epochs
        resume=False,                  # Resume training
        amp=True,                      # Automatic Mixed Precision
        fraction=1.0,                  # Use 100% of dataset
        profile=False,                 # Profile
        freeze=None,                   # Freeze layers
        
        # Loss weights (can be tuned for your specific task)
        box=7.5,                       # Box loss weight
        cls=0.5,                       # Class loss weight
        dfl=1.5,                       # DFL loss weight
    )
    
    print("\n" + "="*60)
    print("Training Complete!")
    print("="*60 + "\n")
    print(f"Best model saved at: runs/segment/transformer_fault_best/weights/best.pt")
    print(f"Last model saved at: runs/segment/transformer_fault_best/weights/last.pt")
    
    return results

if __name__ == "__main__":
    train_model()
