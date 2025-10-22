"""
Transformer Fault Detection - Prediction Script
Run predictions on test images after training
"""

from ultralytics import YOLO
import os
from pathlib import Path
import cv2

def predict_on_test_set():
    """
    Run predictions on the test dataset using the trained model
    """
    
    # Path to the best trained model
    model_path = 'runs/segment/transformer_fault_best/weights/best.pt'
    
    # Check if model exists
    if not os.path.exists(model_path):
        print(f"Error: Model not found at {model_path}")
        print("Please train the model first by running train.py")
        return
    
    # Load the trained model
    print("Loading trained model...")
    model = YOLO(model_path)
    
    print("\n" + "="*60)
    print("Running Predictions on Test Set")
    print("="*60 + "\n")
    
    # Predict on test images
    results = model.predict(
        source='data/test/images',     # Test images directory
        save=True,                     # Save annotated images
        save_txt=True,                 # Save results as txt
        save_conf=True,                # Save confidence scores
        conf=0.25,                     # Confidence threshold (lower for better recall)
        iou=0.7,                       # IoU threshold for NMS
        imgsz=640,                     # Image size
        project='runs/segment',        # Output directory
        name='predict_test',           # Prediction folder name
        exist_ok=True,                 # Overwrite existing
        line_width=2,                  # Bounding box line width
        show_labels=True,              # Show labels
        show_conf=True,                # Show confidence scores
        visualize=False,               # Visualize features
        augment=False,                 # Use augmented inference
        agnostic_nms=False,            # Class-agnostic NMS
        retina_masks=True,             # High-resolution masks
    )
    
    print("\n" + "="*60)
    print("Prediction Complete!")
    print("="*60 + "\n")
    print(f"Results saved at: runs/segment/predict_test")
    print(f"Annotated images: runs/segment/predict_test/")
    
    return results


def predict_single_image(image_path):
    """
    Run prediction on a single image
    
    Args:
        image_path (str): Path to the image file
    """
    
    model_path = 'runs/segment/transformer_fault_best/weights/best.pt'
    
    if not os.path.exists(model_path):
        print(f"Error: Model not found at {model_path}")
        return
    
    if not os.path.exists(image_path):
        print(f"Error: Image not found at {image_path}")
        return
    
    # Load model
    model = YOLO(model_path)
    
    print(f"\nPredicting on: {image_path}")
    
    # Predict
    results = model.predict(
        source=image_path,
        save=True,
        conf=0.25,
        imgsz=640,
        project='runs/segment',
        name='predict_single',
        exist_ok=True,
        show_labels=True,
        show_conf=True,
        retina_masks=True,
    )
    
    # Display results
    for result in results:
        print(f"\nDetected {len(result.boxes)} objects")
        if len(result.boxes) > 0:
            for i, box in enumerate(result.boxes):
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                cls_name = result.names[cls_id]
                print(f"  {i+1}. {cls_name}: {conf:.2%} confidence")
    
    print(f"\nResult saved at: runs/segment/predict_single/")
    
    return results


def predict_on_validation_set():
    """
    Run predictions on the validation dataset
    """
    
    model_path = 'runs/segment/transformer_fault_best/weights/best.pt'
    
    if not os.path.exists(model_path):
        print(f"Error: Model not found at {model_path}")
        return
    
    model = YOLO(model_path)
    
    print("\n" + "="*60)
    print("Running Predictions on Validation Set")
    print("="*60 + "\n")
    
    results = model.predict(
        source='data/valid/images',
        save=True,
        save_txt=True,
        save_conf=True,
        conf=0.25,
        iou=0.7,
        imgsz=640,
        project='runs/segment',
        name='predict_valid',
        exist_ok=True,
        show_labels=True,
        show_conf=True,
        retina_masks=True,
    )
    
    print(f"\nResults saved at: runs/segment/predict_valid")
    
    return results


def predict_on_train_set():
    """
    Run predictions on the training dataset (to check overfitting performance)
    """
    
    model_path = 'runs/segment/transformer_fault_best/weights/best.pt'
    
    if not os.path.exists(model_path):
        print(f"Error: Model not found at {model_path}")
        return
    
    model = YOLO(model_path)
    
    print("\n" + "="*60)
    print("Running Predictions on Training Set")
    print("="*60 + "\n")
    
    results = model.predict(
        source='data/train/images',
        save=True,
        save_txt=True,
        save_conf=True,
        conf=0.25,
        iou=0.7,
        imgsz=640,
        project='runs/segment',
        name='predict_train',
        exist_ok=True,
        show_labels=True,
        show_conf=True,
        retina_masks=True,
    )
    
    print(f"\nResults saved at: runs/segment/predict_train")
    
    return results


if __name__ == "__main__":
    # Predict on test set
    predict_on_test_set()
    
    # Uncomment below to also predict on validation and training sets
    # predict_on_validation_set()
    # predict_on_train_set()
    
    # Example: Predict on a single image
    # predict_single_image('data/test/images/your_image.jpg')
