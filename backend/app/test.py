import requests

API_URL = "https://aviralsaxena16-campus-mail-classifier-api.hf.space/predict"

payload = {
    "subject": "Assignment Deadline - CS101",
    "body": "Please submit by Friday 11:59 PM"
}

resp = requests.post(API_URL, json=payload)
print(resp.status_code)
print(resp.json())
