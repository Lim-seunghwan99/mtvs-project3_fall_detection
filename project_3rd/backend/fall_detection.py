import os
import uuid
import numpy as np
import torch
import torch.nn as nn
from fastapi import (
    FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException,
    UploadFile, File, Form, status, Body
)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError 
from collections import deque
import time
from fastapi.responses import HTMLResponse, FileResponse
import logging
from typing import List

# 로컬 모듈
from . import crud, models, schemas, database, solapi_utils

# --- Constants and Configuration ---
MODEL_PATH = (
    "./project_3rd/backend/spline_best_lstm_model2.pth"
)
NUM_FRAMES_SEQUENCE = 10  # 10개 프레임을 시계열로 예측
NUM_LANDMARKS = 33
INPUT_SIZE = NUM_LANDMARKS * 3  # 33 landmarks * 3 coords (x, y, z)

# --- 내가 학습한 모델과 일치 ---
HIDDEN_SIZE = 64
NUM_LAYERS = 2 
NUM_CLASSES = 4
DROPOUT_RATE = 0.3
BIDIRECTIONAL = True  
# 낙상이 아닌 것이 2 -> 2가 아니면 낙상
FALL_LABEL_INDEX = (
    2  
)
LM_IDX_LEFT_HIP = 23
LM_IDX_RIGHT_HIP = 24
LM_IDX_LEFT_SHOULDER = 11
LM_IDX_RIGHT_SHOULDER = 12
EPSILON = 1e-6  

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {DEVICE}")

# 모델 정의 학습한한 것과 똑같은 것
class FallDetectionLSTM(nn.Module):
    def __init__(
        self,
        input_size,
        hidden_size,
        num_layers,
        num_classes,
        dropout_rate,
        bidirectional=True,
    ):
        super(FallDetectionLSTM, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.num_directions = 2 if bidirectional else 1

        self.lstm = nn.LSTM(
            input_size,
            hidden_size,
            num_layers,
            batch_first=True,  
            dropout=(
                dropout_rate if num_layers > 1 else 0
            ),  # 마지막 레이어 제외하고 드롭아웃 적용
            bidirectional=bidirectional,
        )

        self.dropout = nn.Dropout(dropout_rate)
        self.fc = nn.Linear(hidden_size * self.num_directions, num_classes)

    def forward(self, x):

        lstm_out, _ = self.lstm(x) 
        # 마지막 시점의 출력을 사용
        last_time_step_out = lstm_out[:, -1, :]

        out = self.dropout(last_time_step_out)
        out = self.fc(out)  # 최종 출력 (Softmax 전 Logits)
        return out

try:
    model = FallDetectionLSTM(
        input_size=INPUT_SIZE,
        hidden_size=HIDDEN_SIZE,
        num_layers=NUM_LAYERS,
        num_classes=NUM_CLASSES,
        dropout_rate=DROPOUT_RATE,
        bidirectional=BIDIRECTIONAL,
    )
    model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
    model.to(DEVICE)
    model.eval() 
    print(f"Model loaded successfully from {MODEL_PATH}")
except FileNotFoundError:
    print(f"❌ Error: Model file not found at {MODEL_PATH}")
    exit()
except Exception as e:
    print(f"❌ Error loading model: {e}")
    exit()

def preprocess_sequence(frame_sequence_list):
    """
    이미지별 해상도가 달라 엉덩이중심과 어깨 너비를 사용해 프레임을 정규화
    """
    # 프레임 개수 더블 체크
    if len(frame_sequence_list) != NUM_FRAMES_SEQUENCE:
        print(
            f"Error: Expected {NUM_FRAMES_SEQUENCE} frames, got {len(frame_sequence_list)}"
        )
        return None

    normalized_sequence = []
    for frame_flat in frame_sequence_list:
        try:
            # 2-1. 평탄화된 리스트(99개 값)를 (33, 3) 형태의 numpy 배열로 변환
            frame_coords = np.array(frame_flat, dtype=np.float32).reshape(
                NUM_LANDMARKS, 3
            )
            # 1. 엉덩이 중심 계산
            left_hip = frame_coords[LM_IDX_LEFT_HIP]
            right_hip = frame_coords[LM_IDX_RIGHT_HIP]
            hip_center = (left_hip + right_hip) / 2.0

            # 2. 어깨 너비 계산
            left_shoulder = frame_coords[LM_IDX_LEFT_SHOULDER]
            right_shoulder = frame_coords[LM_IDX_RIGHT_SHOULDER]
            shoulder_width = np.linalg.norm(left_shoulder - right_shoulder) + EPSILON

            # 3. Normalize: (coords - hip_center) / shoulder_width
            normalized_coords = (frame_coords - hip_center) / shoulder_width
            normalized_sequence.append(normalized_coords.flatten())

        except Exception as e:
            print(f"Error during frame normalization: {e}")
            return None  # Indicate failure

    # 3. 정규화된 10개의 프레임들을 하나의 numpy 배열로 합침 (형태: 10, 99)
    sequence_np = np.stack(normalized_sequence, axis=0)

    # 4. Numpy 배열을 토치 텐서로 변환하고, 배치 차원(1) 추가 (형태: 1, 10, 99)
    sequence_tensor = torch.from_numpy(sequence_np).float().unsqueeze(0).to(DEVICE)
    return sequence_tensor


# --- FastAPI Application ---
# =============================================================================================================
app = FastAPI(title="Fall Detection API with DB")

origins = ["http://localhost:5173", "http://127.0.0.1:5173"]  # React 앱의 주소, .env에서 import하는 형태로 수정(로컬이라 그냥 사용)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 위에서 정의한 출처 목록, cloudflare로 발표해, 현재는 모든 출처 허용
    allow_credentials=True,  # 쿠키를 포함한 요청을 허용할지 여부 (필요하다면 True)
    allow_methods=["*"],  # 허용할 HTTP 메소드 (GET, POST, PUT 등 모두 허용)
    allow_headers=["*"],  # 허용할 HTTP 헤더 (모든 헤더 허용)
)


logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)

# 앱 시작 시 DB 테이블 생성
try:
    print("데이터베이스 테이블 생성 시도")
    models.Base.metadata.create_all(bind=database.engine)
    print("테이블 확인 / 생성 완료")
    
except Exception as e:
    print(f"오류 {e}")

# '/ws/fall-detection' 경로로 웹소켓 연결을 처리하는 엔드포인트 정의
@app.websocket("/ws/fall-detection")
async def websocket_endpoint(websocket: WebSocket):
    # 웹소켓 연결
    await websocket.accept()
    print("WebSocket connection accepted.")
    # 데크 사용, 프레임 10개
    frame_buffer = deque(maxlen=NUM_FRAMES_SEQUENCE)
    last_fall_detected_time = 0.0 # 마지막 낙상 감지 시간을 기록 (0.0으로 초기화)
    FALL_COOLDOWN_SECONDS = 600   # 낙상 감지 후 쿨다운 시간 (초)

    try:
        # 클라이언트로부터 메시지를 계속 받기 위한 무한 루프
        while True:
            data = await websocket.receive_json()

            # 1. 수신된 데이터 검증
            if isinstance(data, list) and len(data) == INPUT_SIZE:
                frame_buffer.append(data)

                if len(frame_buffer) == NUM_FRAMES_SEQUENCE:
                    # 2. 전처리 수행: 버퍼의 내용을 리스트로 변환하여 preprocess_sequence 함수에 전달
                    input_tensor = preprocess_sequence(list(frame_buffer))

                    # 3. 전처리가 성공적으로 완료되었으면 (None이 아니면) 모델 추론 수행
                    if input_tensor is not None:
                        with torch.no_grad():  
                            # 1. 모델 예측 실행 (출력은 로짓 - Softmax 전 값)
                            outputs = model(input_tensor)

                            # 2. Softmax를 적용하여 각 클래스에 대한 확률 계산
                            probabilities = torch.softmax(outputs, dim=1)

                            # 3. 가장 높은 확률과 해당 클래스 인덱스 찾기
                            confidence, predicted_index = torch.max(probabilities, dim=1)

                            # --- 모든 클래스 확률 추출해서 확인 ---
                            all_probabilities_list = probabilities[0].tolist()

                        predicted_label = predicted_index.item()
                        pred_confidence = confidence.item()

                        current_time = time.time() # 현재 시간

                        # 클라이언트에게 보낼 데이터에 모든 확률 포함
                        response_data = {
                            "status": "NORMAL", # 정상인 경우
                            "predicted_label": predicted_label,
                            "confidence": pred_confidence, # 최고 확률
                            "all_probabilities": all_probabilities_list # 모든 확률 리스트
                        }

                        # 낙상 감지 여부 확인 및 상태 업데이트
                        if predicted_label != FALL_LABEL_INDEX:
                            if (current_time - last_fall_detected_time) > FALL_COOLDOWN_SECONDS:
                                print("🚨 Fall Detected")
                                print(
                                    f"All Probabilities: {all_probabilities_list}, Max Confidence={pred_confidence:.4f}"
                                )
                                response_data["status"] = "FALL_DETECTED" # 상태 오버라이드
                                last_fall_detected_time = current_time  # 마지막 낙상 감지 시간 업데이트
                            else:
                                print("낙상 감지 10분 쿨다운 중")

                        # 클라이언트에게 결과 전송
                        await websocket.send_json(response_data)

                    else:
                        print("⚠️ Preprocessing failed for the current sequence.")

            else:
                # 수신된 데이터 형식이 잘못되었을 경우 오류 메시지 출력 및 클라이언트에 전송
                print(
                    f"⚠️ 잘못된 데이터 형식 또는 길이를 수신했습니다. {INPUT_SIZE}개의 숫자로 이루어진 리스트가 필요합니다."
                )
                await websocket.send_json(
                    {
                        "error": f"잘못된 데이터 형식입니다. {INPUT_SIZE}개의 숫자로 이루어진 리스트가 필요합니다."
                    }
                )

    except WebSocketDisconnect:
        # 클라이언트가 연결을 끊었을 때
        print("웹소켓 연결 끊어짐.")
    except Exception as e:
        # 그 외 예외 발생 시
        print(f"오류 발생: {e}")
        # 클라이언트에게 오류를 알리고 연결 종료 시도
        try:
            await websocket.close(code=1011, reason=f"서버 오류: {e}")
        except Exception:
            pass  # 연결 종료 시도 중 발생하는 오류는 무시

BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # 현재 파이썬 파일 기준
PHOTO_DIR = os.path.join(BASE_DIR, "static", "photos")

# HTTP 엔드포인트 정의
@app.post("/fall-events/", status_code=status.HTTP_201_CREATED, summary="낙상 이벤트 생성")
async def create_fall_event(
    phone_number: str = Form(..., description="전화번호"),
    fall_type: str = Form(..., description="낙상 유형"),
    photo: UploadFile = File(None),  # 사진 파일을 오류 있을 수 있어 Optional로 설정
    db: Session = Depends(database.get_db),
):
    """
    낙상 이벤트를 생성합니다.
    """
    logger.info(f"DB 저장 요청 수신 - 전화번호: {phone_number}, 종류: {fall_type}")
    try:
        # 사진 데이터 읽기 (Optional)
        photo_filename = None
        if photo:
            # 사진 파일 이름 생성 (전화번호 + 현재 시간)
            extension = photo.filename.split('.')[-1]
            photo_filename = f"{uuid.uuid4()}.{extension}"
            photo_filepath = os.path.join(PHOTO_DIR, photo_filename)

            # 디렉토리가 없으면 생성
            os.makedirs(PHOTO_DIR, exist_ok=True)

            with open(photo_filepath, "wb") as f:
                f.write(await photo.read())
            logger.info(f"사진 파일 저장 완료: {photo_filepath}")

        # DB에 낙상 이벤트 생성
        fall_event = crud.create_fall_event(
            db=db,
            phone_number=phone_number,
            fall_type=fall_type,
            photo_data=photo_filename,  # 파일명 저장으로 코드 변경
        )
        logger.info(f"DB 저장 성공: ID={fall_event.id}, 전화번호={phone_number} at {fall_event.fall_timestamp}")
        return {
            "message": "Fall event data saved successfully to database.",
            "event_id": (
                fall_event.id,  # ID 반환 (auto_increment 사용 시 ID 반환
            ),  # id를 PK로 사용 시 ID 반환
            "phone_number": fall_event.phone_number,
            "fall_timestamp": fall_event.fall_timestamp,
            "photo_filename": photo_filename,
        }

    except IntegrityError as e:
        db.rollback()
        logger.error(f"DB 저장 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="{e}",
        )
    except Exception as e:
        db.rollback()
        logger.error(f"서버 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"서버 오류: {e}",
        )

    finally:
        if photo:
            await photo.close()


@app.get("/fall-events/{phone_number}",
         response_model=List[schemas.FallEventResponse],
         summary="전화번호로 낙상 이벤트 조회")
async def read_fall_events_by_phone(
    phone_number: str,
    db: Session = Depends(database.get_db)
    ):
    logger.info(f"전화번호 {phone_number}로 낙상 이벤트 조회 요청")
    fall_events = crud.get_fall_event_by_phone_number(db=db, phone_number=phone_number)
    if not fall_events:
        logger.info(f"전화번호 {phone_number}에 대한 낙상 이벤트 없음")
    logger.info(f"조회된 낙상 이벤트 수: {len(fall_events)}")
    return fall_events


@app.get("/static/photos/{photo_filename}")
async def get_photo(photo_filename: str):
    photo_path = os.path.join(PHOTO_DIR, photo_filename)
    if not os.path.exists(photo_path):
        raise HTTPException(status_code=404, detail="Photo not found")
    return FileResponse(photo_path)

@app.post("/send-sms/", status_code=status.HTTP_200_OK, summary="SMS 발송")
async def send_sms(
    sms_request: schemas.SMSRequest = Body(...),
    ):
    """
    SMS 발송 요청을 처리합니다.
    """
    logger.info(
        f"SMS 발송 요청 수신 - 수신번호: {sms_request.to_number}, 내용: {sms_request.text}"
    )
    try:
        # SMS 발송
        solapi_utils.send_sms(
            to_number=sms_request.to_number,
            from_number="010-7185-9709",  # 발신번호 (Solapi 콘솔에서 인증 필요)
            text=sms_request.text,
        )
        return {"message": "SMS sent successfully."}
    except Exception as e:
        logger.error(f"SMS 발송 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"SMS 발송 실패: {e}",
        )

# uvicorn project_3rd.backend.fall_detection:app --reload
