# Test script to upload a different image and check analysis results
import requests
import json

# Test with a different image file
test_image_path = r"D:\7 sem\Software project\smart-thermal-inspection\backend\media\baseline\AZ-1111.jpg"

try:
    with open(test_image_path, 'rb') as image_file:
        files = {'thermalImage': image_file}
        data = {
            'transformerId': 'TEST001',
            'inspectionId': '123'
        }
        
        response = requests.post(
            'http://localhost:8080/api/analyze-thermal-image',
            files=files,
            data=data,
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Detections found: {len(result.get('detections', []))}")
            for i, detection in enumerate(result.get('detections', [])):
                print(f"  {i+1}. {detection.get('class')} - {detection.get('confidence'):.2f}")
        else:
            print(f"Error: {response.status_code}")
            
except Exception as e:
    print(f"Error: {e}")