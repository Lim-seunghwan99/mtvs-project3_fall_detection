// src/pages/RealTimePage.jsx
import React, { useState, useCallback, useRef } from 'react';
import FallDetectionCam from '../components/FallDetectionCam/FallDetectionCam';
import HistoryLog from '../components/HistoryLog/HistoryLog';
import { API_BASE_URL } from '../config/constants'; 

const FALL_TYPE_MAP = {
  0: 'BY', 
  1: 'FY', 
  2: 'N',  
  3: 'SY'  
};
function RealTimePage({ loggedInPhoneNumber }) {
  const [realTimeFallHistory, setRealTimeFallHistory] = useState([]);
  const [isSaving, setIsSaving] = useState(false);  
  const [saveError, setSaveError] = useState(null); 
  const [lastSavedInfo, setLastSavedInfo] = useState(null); 

  // SMS 발송
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsSendError, setSmsSendError] = useState(null);
  const [smsSendSuccess, setSmsSendSuccess] = useState(null);

  const fallDetectionCamRef = useRef(null); 

  const captureVideoFrame = useCallback(async () => {
    if (!fallDetectionCamRef.current) {
      return null;
    }

    const videoElement = fallDetectionCamRef.current.getVideoElement();

      // 3. 비디오 요소 및 상태 확인
    if (!videoElement || videoElement.readyState < videoElement.HAVE_CURRENT_DATA) {
      console.error("Video element is not ready or not available. State:", videoElement?.readyState);
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');

    const currentActiveCamera = fallDetectionCamRef.current.getActiveCamera?.(); 
    const isFrontCamera = currentActiveCamera === 'front';

    if (isFrontCamera) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1); 
    }

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.9); 
      });
  }, []);

  // --- SMS 발송 함수 (RealTimePage 내부에 정의 또는 별도 유틸리티) ---
  const sendFallAlertSms = useCallback(async (phoneNumber, fallType, timestamp) => {
    if (!phoneNumber) {
      return; 
    }

    setIsSendingSms(true); 
    setSmsSendError(null);
    setSmsSendSuccess(null);

    // 서버로 보낼 메시지 내용 구성, 90자 이내
    const messageText = `[낙상] ${phoneNumber} 님 ${timestamp} 경 ${fallType} 감지 확인 요망.`;

    try {
      console.log(`[SMS] 발송 시도: To=${phoneNumber}, Text=${messageText}`);
      const response = await fetch(`${API_BASE_URL}/send-sms/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', 
        },
        body: JSON.stringify({ 
          to_number: phoneNumber, 
          text: messageText,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'SMS 발송 API 오류' }));
        throw new Error(errorData.detail || `SMS 발송 실패: ${response.status}`);
      }

      const result = await response.json();
      console.log("[SMS] 발송 성공:", result);
      setSmsSendSuccess("SMS 알림이 성공적으로 발송되었습니다.");

    } catch (error) {
      console.error("[SMS] 발송 오류:", error);
      setSmsSendError(`SMS 발송 실패: ${error.message}`);
    } finally {
      setIsSendingSms(false); 
    }
  }, []); 

  const handleRealTimeFallDetected = useCallback(async (fallData) => {
    console.log("RealTimePage: Fall detected:", fallData);
    setRealTimeFallHistory(prevHistory => [...prevHistory, fallData]);
    setIsSaving(false);
    setSaveError(null);
    setLastSavedInfo(null);
    if (loggedInPhoneNumber && fallData.status === 'FALL_DETECTED') {
      setIsSaving(true);

      try {
        const predictedLabel = fallData.predicted_label;
        const fallType = FALL_TYPE_MAP[predictedLabel] || `Unknown (${predictedLabel})`; 
        const photoBlobb = await captureVideoFrame();
        if (!photoBlobb) {
          throw new Error("Failed to capture video frame.");
        }
        const formData = new FormData();
        formData.append('phone_number', loggedInPhoneNumber);
        formData.append('fall_type', fallType); 
        formData.append('photo', photoBlobb, `${loggedInPhoneNumber}_fall_${Date.now()}.jpg`); 

        const dbresponse = await fetch(`${API_BASE_URL}/fall-events/`, {
          method: 'POST',
          body: formData,
        });

        if (!dbresponse.ok) {
          const errorData = await dbresponse.json().catch(() => ({ detail: '알 수 없는 오류' }));
          throw new Error(errorData.detail || `HTTP 오류 상태: ${dbresponse.status}`);
        }

        const resultData = await dbresponse.json();
        setLastSavedInfo(resultData); 
        let savedEventTimestamp = resultData.timestamp; 

        // SMS 발송 호출
        const timeForSms = savedEventTimestamp ? new Date(savedEventTimestamp).toLocaleString('ko-KR') : fallData.timestamp; 
        await sendFallAlertSms(loggedInPhoneNumber, fallType, timeForSms);

      } catch (error) {

        console.error("Error saving fall data:", error);
        setSaveError(error.message); 

      } finally {
        setIsSaving(false); 
      }

    } else if  (fallData.status === 'FALL_DETECTED') {
      setSaveError("전화번호가 등록되지 않았습니다. 기록을 저장할 수 없습니다.");
    }
  }, [loggedInPhoneNumber, captureVideoFrame]); // loggedInPhoneNumber과 captureVideoFrame이 변경될 때만 재실행

  return (
    <div>
      {loggedInPhoneNumber ? (
        <p>현재 등록된 번호: <strong>{loggedInPhoneNumber}</strong></p>
      ) : (
        <p>전화번호가 등록되지 않았습니다. 기록 조회를 위해 먼저 번호를 등록하세요.</p>
      )}
      <FallDetectionCam ref={fallDetectionCamRef} onFallDetected={handleRealTimeFallDetected} />
      <HistoryLog title="실시간 감지 기록" history={realTimeFallHistory} />
      <div className="status-area" style={{ marginTop: '20px', padding: '10px', border: '1px solid #eee' }}>
        <h4>처리 상태</h4>
        {isSaving && <p style={{ color: 'blue' }}>낙상 정보 저장 중...</p>}
        {saveError && <p style={{ color: 'red' }}>오류: {saveError}</p>}
        {lastSavedInfo && (
          <div style={{ color: 'green' }}>
            <p>✔️ DB 저장 성공 (ID: {lastSavedInfo.event_id})</p>
          </div>
        )}
        {isSendingSms && <p style={{ color: 'blue', marginTop: '5px' }}>SMS 알림 발송 중...</p>}
        {smsSendError && <p style={{ color: 'red', marginTop: '5px' }}>SMS 오류: {smsSendError}</p>}
        {smsSendSuccess && <p style={{ color: 'green', marginTop: '5px' }}>✔️ {smsSendSuccess}</p>}
      </div>
    </div>
  );
}

export default RealTimePage;