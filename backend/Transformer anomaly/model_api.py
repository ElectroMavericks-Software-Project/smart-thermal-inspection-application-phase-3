# BACKEND API FOR IMAGE PREDICTION
# This script accepts image path as command line argument

from inference_sdk import InferenceHTTPClient
import supervision as sv
import json
import sys
import cv2
import os


def predict_image(image_path):
    try:
        print(f"PYTHON MODEL DEBUG: Processing image: {image_path}", file=sys.stderr)
        
        # Check if image file exists
        import os
        if os.path.exists(image_path):
            print(f"PYTHON MODEL DEBUG: Image file exists, size: {os.path.getsize(image_path)} bytes", file=sys.stderr)
        else:
            print(f"PYTHON MODEL DEBUG: WARNING - Image file does not exist!", file=sys.stderr)
        
        # Initialize the inference client
        client = InferenceHTTPClient(
            api_url="https://detect.roboflow.com",
            api_key=os.environ.get("API_KEY", "")
        )
        
        # Run inference on the image with your updated model
        results = client.infer(image_path, model_id="transformer-fault-detection-llssu/2")
        
        print(f"PYTHON MODEL DEBUG: Inference completed, found {len(results.get('predictions', []))} predictions", file=sys.stderr)
        
        # Return the results
        return results
    except Exception as e:
        print(f"Error in prediction: {str(e)}", file=sys.stderr)
        return {"predictions": []}



if __name__ == "__main__":
    # Check if image path is provided as argument
    if len(sys.argv) < 2:
        print("Usage: python model_api.py <image_path>", file=sys.stderr)
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    # Make prediction
    result = predict_image(image_path)
    
    # Access predictions from inference_sdk results
    predictions = result.get("predictions", [])
    
    # Format detections for API response
    detections = []
    for pred in predictions:
        detection = {
            "class": pred.get('class', 'unknown'),
            "confidence": pred.get('confidence', 0.0),
            "bounding_box": {
                "x": pred.get('x', 0),
                "y": pred.get('y', 0),
                "width": pred.get('width', 0),
                "height": pred.get('height', 0)
            },
            "detection_id": pred.get('detection_id', '')
        }
        detections.append(detection)
    
    # Output the detections as JSON (this will be captured by Java)
    print(json.dumps(detections))