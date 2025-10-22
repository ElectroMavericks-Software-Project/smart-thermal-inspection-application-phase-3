from roboflow import Roboflow
import supervision as sv
import cv2
import os

# define the image url to use for inference
image_file = r"D:\7 sem\Software project\smart-thermal-inspection\backend\Transformer anomaly\dataset\T4\normal\T4_normal_002.png"
image = cv2.imread(image_file)

# Initialize Roboflow client with updated project
rf = Roboflow(api_key=os.environ.get("API_KEY", ""))
project = rf.workspace().project("transformer-fault-detection-llssu")
model = project.version(2).model

# Instance segmentation models only accept 'confidence', not 'overlap'
result = model.predict(image_file, confidence=10).json()

labels = [item["class"] for item in result["predictions"]]

# Use from_inference() instead of from_roboflow()
detections = sv.Detections.from_inference(result)

# create supervision annotators
bounding_box_annotator = sv.BoxAnnotator()
label_annotator = sv.LabelAnnotator()

# annotate the image with our inference results
annotated_image = bounding_box_annotator.annotate(
    scene=image, detections=detections)
annotated_image = label_annotator.annotate(
    scene=annotated_image, detections=detections, labels=labels)

# display the image
sv.plot_image(image=annotated_image, size=(16, 16))