# solapi_test.py
import requests
import json
import uuid
import time
import hmac
import hashlib
from datetime import datetime
from zoneinfo import ZoneInfo
import os
from dotenv import load_dotenv
load_dotenv(dotenv_path="project_3rd/backend/.env")
api_key = os.getenv("API_KEY")
api_secret = os.getenv("API_SECRET")

def generate_headers():
    # ISO 8601 형식으로 timestamp 생성
    kst = ZoneInfo("Asia/Seoul")
    now_kst = datetime.now(kst)
    timestamp = now_kst.strftime("%Y-%m-%d %H:%M:%S")
    salt = str(uuid.uuid4())
    signature_data = timestamp + salt
    signature = hmac.new(
        bytes(api_secret, 'utf-8'),
        bytes(signature_data, 'utf-8'),
        hashlib.sha256
    ).hexdigest()

    return {
        'Content-Type': 'application/json',
        'Authorization': f'HMAC-SHA256 apiKey={api_key}, date={timestamp}, salt={salt}, signature={signature}'
    }

def send_sms(to_number, from_number, text):
    headers = generate_headers()

    payload = {
        'message': {
            'to': to_number,
            'from': from_number,  # 발신번호 (Solapi 콘솔에서 인증 필요)
            'text': text,
            'type': 'SMS'
        }
    }

    response = requests.post('https://api.solapi.com/messages/v4/send', headers=headers, data=json.dumps(payload))
    print("응답 코드:", response.status_code)
    try:
        print("응답 내용:", response.json())
    except Exception as e:
        print("응답 파싱 실패:", e)
        print("응답 원문:", response.text)

# 콘솔에서 'send' 입력 시 문자 발송
def check_and_send_sms(to_number, from_number, text):
    user_input = input("입력하세요 (send 입력 시 문자 발송): ")

    if user_input.lower() == 'send':
        send_sms(to_number, from_number, text)
    else:
        print("잘못된 입력입니다. 'send'라고 입력해야 합니다.")

