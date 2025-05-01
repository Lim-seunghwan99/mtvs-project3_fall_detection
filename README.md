# 🌼 mtvs-project3_fall_detection - '피우다' 프로젝트

**장애인, 노인, 경계선지능인의 생활 개선 및 복지 향상을 위한 낙상 인식 및 대응 시스템**

---

## 🧠 프로젝트 소개

'피우다'는 낙상 사고의 사전 인지 및 신속한 대응을 통해 취약계층의 안전한 생활을 지원하는 **AI 기반 낙상 감지 시스템**입니다.  
딥러닝 기반 시계열 분석 모델(LSTM)을 활용하여 실시간으로 사용자의 움직임을 분석하고, 낙상 징후를 인식하면 즉시 SMS를 통해 알립니다.
기간 2025.04.23 ~ 2025.05.01
모델 정확도
낙상 (BY, FY, N, SY)정확도: 48.87%
낙상 Y, N정확도: 75.34%

---



## 🖼️ 시스템 아키텍처

![System Architecture](systemarchitecture.png)

---

## 🧩 데이터베이스 ERD

![ERD](erd.png)

---

## 🎥 시연 영상 (Demo)

![Fall Detection Demo](project3_detecting.gif)

> 위 이미지는 낙상 인식 동작을 시각적으로 보여주는 예시입니다.
> 고화줄의 영상의 경우, 같은 경로의 mp4 파일을 확인해주세요

![SMS 확인 문자자](KakaoTalk_20250430_174101447.jpg)
---

## 🛠️ 주요 기능

- 실시간 관절 데이터 기반 낙상 인식 (Pose Estimation)
- 4가지 낙상 패턴 분류 (앞으로 넘어짐, 옆으로 넘어진, 뒤로 넘어짐, 정상)
- 감지 즉시 보호자 알림 전송
- 웹 GUI를 통한 모니터링 및 데이터 확인

---

## 🔧 기술 스택

- **Frontend**: React
- **Backend**: FastAPI  
- **AI Model**: PyTorch 기반 LSTM 분류기  
- **Database**: PostgreSQL  
- **solapi**: SMS 전송 API
- **ETC**: MediaPipe, OpenCV, Cloudflare

---

## 📂 프로젝트 구조

- `backend` : FastAPI 서버 및 LSTM 모델 관련 코드
- `frontend` : React 기반 웹 애플리케이션
- `database` : WSL에 설치 PostgreSQL
- `model` : LSTM 모델 학습 및 평가 코드(PyTorch)

