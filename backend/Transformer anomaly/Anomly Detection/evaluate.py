"""
Transformer Fault Detection - Evaluation Script
Evaluate model performance on all datasets
"""

from ultralytics import YOLO
import os

def evaluate_model():
    """
    Evaluate the trained model on validation and test sets
    """
    
    model_path = 'runs/segment/transformer_fault_best/weights/best.pt'
    
    if not os.path.exists(model_path):
        print(f"Error: Model not found at {model_path}")
        print("Please train the model first by running train.py")
        return
    
    # Load the trained model
    print("Loading trained model...")
    model = YOLO(model_path)
    
    print("\n" + "="*70)
    print(" "*20 + "MODEL EVALUATION")
    print("="*70 + "\n")
    
    # Evaluate on validation set
    print("="*70)
    print("Evaluating on VALIDATION SET")
    print("="*70)
    val_metrics = model.val(
        data='data/data.yaml',
        split='val',
        imgsz=640,
        batch=16,
        conf=0.25,
        iou=0.7,
        save_json=True,
        plots=True,
        project='runs/segment',
        name='eval_validation',
        exist_ok=True,
    )
    
    print("\nValidation Results:")
    print(f"  mAP50: {val_metrics.seg.map50:.4f}")
    print(f"  mAP50-95: {val_metrics.seg.map:.4f}")
    print(f"  Precision: {val_metrics.seg.mp:.4f}")
    print(f"  Recall: {val_metrics.seg.mr:.4f}")
    
    # Evaluate on test set (manual prediction since YOLO val requires labels)
    print("\n" + "="*70)
    print("Evaluating on TEST SET")
    print("="*70)
    test_metrics = model.val(
        data='data/data.yaml',
        split='test',
        imgsz=640,
        batch=16,
        conf=0.25,
        iou=0.7,
        save_json=True,
        plots=True,
        project='runs/segment',
        name='eval_test',
        exist_ok=True,
    )
    
    print("\nTest Results:")
    print(f"  mAP50: {test_metrics.seg.map50:.4f}")
    print(f"  mAP50-95: {test_metrics.seg.map:.4f}")
    print(f"  Precision: {test_metrics.seg.mp:.4f}")
    print(f"  Recall: {test_metrics.seg.mr:.4f}")
    
    print("\n" + "="*70)
    print(" "*25 + "SUMMARY")
    print("="*70)
    print("\nClass-wise Performance (Validation):")
    print("-" * 70)
    
    # Print per-class metrics if available
    if hasattr(val_metrics.seg, 'ap_class_index'):
        for i, cls_idx in enumerate(val_metrics.seg.ap_class_index):
            cls_name = model.names[int(cls_idx)]
            print(f"  {cls_name:30s} - mAP50: {val_metrics.seg.ap50[i]:.4f}")
    
    print("\n" + "="*70)
    print("Evaluation Complete!")
    print("="*70)
    print(f"\nDetailed results saved at:")
    print(f"  Validation: runs/segment/eval_validation/")
    print(f"  Test: runs/segment/eval_test/")
    
    return val_metrics, test_metrics


if __name__ == "__main__":
    evaluate_model()
