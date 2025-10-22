# MINIMAL BACKEND CODE FOR IMAGE PREDICTION
# Copy this code to your backend application

from roboflow import Roboflow
import json
import cv2
import os

def predict_image(image_path):
    # Initialize Roboflow client with updated project
    rf = Roboflow(api_key=os.environ.get("API_KEY", ""))
    project = rf.workspace().project("transformer-fault-detection-llssu")
    model = project.version(2).model
    
    # Make prediction with lower confidence threshold
    result = model.predict(image_path, confidence=10)
    
    # Return the JSON result
    return result.json()

# Test with your image
result = predict_image(r"D:\7 sem\Software project\smart-thermal-inspection\backend\Transformer anomaly\dataset\T4\faulty\T4_faulty_001.png")

# Pretty print the result
# print(json.dumps(result, indent=2))

# Access predictions
predictions = result["predictions"]

detections = []
for i, pred in enumerate(predictions):
    detection = {
        "class": pred['class'],
        "confidence": pred['confidence'],
        "bounding_box": {
            "x": pred['x'],
            "y": pred['y'],
            "width": pred['width'],
            "height": pred['height']
        },
        "detection_id": pred['detection_id']
    }
    detections.append(detection)

print(f"Number of anomalies detected: {len(detections)}")
print()
print(detections)
print()

# print(predictions)

import matplotlib.pyplot as plt

# Load the image
image = cv2.imread(r"D:\7 sem\Software project\smart-thermal-inspection\backend\Transformer anomaly\dataset\T4\normal\T4_normal_002.png")
image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

# Draw bounding boxes and confidence scores
for det in detections:
    x = int(det["bounding_box"]["x"])
    y = int(det["bounding_box"]["y"])
    w = int(det["bounding_box"]["width"])
    h = int(det["bounding_box"]["height"])
    conf = det["confidence"]
    label = f"{det['class']} ({conf:.2f})"
    
    # Draw rectangle
    cv2.rectangle(image, (x, y), (x + w, y + h), (255, 0, 0), 2)
    # Put confidence text
    cv2.putText(image, label, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 0), 2)

# Show image in a popup window
plt.figure(figsize=(10, 8))
plt.imshow(image)
plt.axis('off')
plt.title("Detected Anomalies")
plt.show()