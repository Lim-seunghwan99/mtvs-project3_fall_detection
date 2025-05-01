// src/components/FallDetectionCam/FallDetectionCam.jsx
import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { WS_URL } from '../../config/constants'; 

const FallDetectionCam = forwardRef(({ onFallDetected }, ref) => {
  // --- Refs ---
  const videoRef = useRef(null); 
  const canvasRef = useRef(null);
  const poseRef = useRef(null); 
  const cameraRef = useRef(null); 
  const webSocketRef = useRef(null); 

  // --- State ---
  const [isStreaming, setIsStreaming] = useState(false); 
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState(null); 
  const [webSocketStatus, setWebSocketStatus] = useState('Disconnected'); 
  const [predictionResult, setPredictionResult] = useState(null); 
  const [activeCamera, setActiveCamera] = useState(null); 

  // 부모 컴포넌트에서 ref를 통해 접근할 수 있는 메서드 정의
  useImperativeHandle(ref, () => ({
    getVideoElement: () => videoRef.current,
    getActiveCamera: () => activeCamera, 
  }));

  // --- WebSocket 연결 관리 ---
  const connectWebSocket = useCallback(() => {
    if (webSocketRef.current && (webSocketRef.current.readyState === WebSocket.OPEN || webSocketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setWebSocketStatus('Connecting');
    const ws = new WebSocket(WS_URL); 

    ws.onopen = () => {
      setWebSocketStatus('Connected');
      webSocketRef.current = ws;
    };

    ws.onmessage = (event) => {
      if (event.data.status === "FALL_DETECTED") {
      }
      
      try {
        const data = JSON.parse(event.data);
        setPredictionResult(data); 
        // --- 낙상 감지 시 콜백 호출 ---
        if (data.status === "FALL_DETECTED" && typeof onFallDetected === 'function') {
          const timestampKR = new Date().toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul', 
          year: 'numeric', month: 'numeric', day: 'numeric',
          hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false // 24시간 형식
        });
          // 낙상 감지 데이터 객체 생성
          const fallEventData = {
            timestamp: timestampKR,
            confidence: data.confidence,
            probabilities: data.all_probabilities,
            predicted_label: data.predicted_label,
            status: data.status
          };
          onFallDetected(fallEventData);
        }
        // --- 낙상 감지 콜백 호출 끝 ---
      } catch (err) {
        console.error("웹소켓 메시지 파싱 오류:", err);
        setPredictionResult({ error: "서버 응답 처리 오류" });
      }
    };

    ws.onerror = (err) => {
      setError("웹소켓 연결 오류 발생");
      setWebSocketStatus('Error');
      webSocketRef.current = null;
    };

    ws.onclose = (event) => {
      if (event.code !== 1000 && event.code !== 1001 && event.code !== 1011 ) {
        setError(`웹소켓 연결이 비정상적으로 종료되었습니다 (코드: ${event.code})`);
        setWebSocketStatus('Error');
      } else if (event.code === 1011){
         setError(`웹소켓 서버 오류로 연결이 종료되었습니다.`);
         setWebSocketStatus('Error');
      }
      else {
         setWebSocketStatus('Disconnected');
      }
      webSocketRef.current = null;
    };
  }, []); 

  const disconnectWebSocket = useCallback(() => {
    if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
      webSocketRef.current.close(1000, "Client disconnecting"); 
    }
    webSocketRef.current = null;
    setWebSocketStatus('Disconnected');
    setPredictionResult(null);
  }, []);

  // --- MediaPipe 결과 처리 및 데이터 전송 ---
  const onResults = useCallback((results) => {
    if (!canvasRef.current || !videoRef.current) {
      return;
    }

    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext('2d');
    const videoElement = videoRef.current;

    if (canvasElement.width !== videoElement.videoWidth) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.restore();

    // --- 서버로 데이터 전송 ---
    const ws = webSocketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && results.poseLandmarks) {
      const poseDataArray = [];
      // MediaPipe는 poseLandmarks (이미지 좌표 0~1), poseWorldLandmarks (월드 좌표 미터 단위) 제공
      // 백엔드 전처리(엉덩이 중심, 어깨 너비 기반 정규화)는 상대적인 비율을 사용하므로,
      // 둘 중 하나를 일관되게 사용하면 괜찮을 수 있음. WorldLandmarks가 3D 정보가 더 정확.
      const landmarksToUse = results.poseWorldLandmarks || results.poseLandmarks;

      if (landmarksToUse) {
          landmarksToUse.forEach(lm => {
            // 백엔드가 x, y, z 순서의 99개 숫자 배열을 기대함
            poseDataArray.push(lm.x);
            poseDataArray.push(lm.y);
            poseDataArray.push(lm.z ?? 0.0);
          });

          // 정확히 99개의 데이터(33 * 3)가 있는지 확인
          if (poseDataArray.length === 99) {
            ws.send(JSON.stringify(poseDataArray));
          } else {
            console.warn(`랜드마크 데이터 길이 오류: ${poseDataArray.length}개 (예상: 99개)`);
          }
      }
    }
  }, [onFallDetected]); // webSocketRef는 ref이므로 의존성 배열에 불필요

  // --- MediaPipe 초기화 및 카메라 설정 ---
  useEffect(() => {
    if (typeof window.Pose === 'undefined' || typeof window.Camera === 'undefined' || typeof window.drawLandmarks === 'undefined') {
      setError("필수 MediaPipe 스크립트 로드 실패. 인터넷 연결 및 index.html 설정을 확인하세요.");
      console.error("하나 이상의 MediaPipe 스크립트(Pose, Camera, drawing_utils)가 window 객체에 없습니다.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const pose = new window.Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });
    poseRef.current = pose;

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    pose.onResults(onResults);

    if (videoRef.current) {
      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current && poseRef.current) {
            try {
              await poseRef.current.send({ image: videoRef.current });
            } catch (cameraError) {
              console.error("Pose send error:", cameraError);
              setError(`카메라 프레임 처리 오류: ${cameraError.message}`);
              stopStreaming();
            }
          }
        },
        width: 640,
        height: 480
      });
      cameraRef.current = camera;
    } else {
        console.error("비디오 요소 참조 실패");
        setError("비디오 요소를 찾을 수 없습니다.");
    }

    setIsLoading(false); 
    return () => {
      stopStreaming(); 
      if (poseRef.current && typeof poseRef.current.close === 'function') {
        poseRef.current.close();
      }
    };
  }, [onResults]); // stopStreaming은 useCallback으로 감싸져 있고 내부에서 ref를 사용하므로 의존성 추가 불필요

  // --- 컨트롤 함수 ---
  const startStreaming = useCallback(async () => {
    if (isStreaming || isLoading) return;
    setError(null); 
    setIsLoading(true); 

    try {
      if (cameraRef.current) {
        await cameraRef.current.start(); 
        setIsStreaming(true);
        connectWebSocket(); 
      } else {
        throw new Error("카메라 유틸리티가 초기화되지 않았습니다.");
      }
    } catch (err) {
      console.error("카메라/스트리밍 시작 실패:", err);
      let errorMessage = `웹캠 시작 실패: ${err.message || '알 수 없는 오류'}`;
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        errorMessage = '웹캠 접근 권한이 거부되었습니다. 브라우저 설정을 확인해주세요.';
      } else if (err.name === 'NotFoundError' || err.message?.includes('not found')) {
         errorMessage = '사용 가능한 웹캠 장치를 찾을 수 없습니다.';
      }
      setError(errorMessage);
      setIsStreaming(false); 
    } finally {
        setIsLoading(false); 
    }
  }, [isLoading, isStreaming, connectWebSocket]);

  const stopStreaming = useCallback(() => {
    if (!isStreaming && webSocketStatus === 'Disconnected') return; // 이미 중지 상태면 아무것도 안함

    setIsStreaming(false); 
    // 웹소켓 연결 해제
    disconnectWebSocket();
    if (cameraRef.current && typeof cameraRef.current.stop === 'function') {
        try {
          console.log("카메라 중지됨 (MediaPipe Camera Util)");
        } catch (e) {
            console.warn("카메라 중지 중 오류:", e);
        }
    }

    // 비디오 트랙 직접 중지
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    setPredictionResult(null); 

  }, [isStreaming, webSocketStatus, disconnectWebSocket]); // cameraRef, videoRef는 ref

  return (
    <div>
      <h1>실시간 낙상 감지 (MediaPipe + WebSocket)</h1>
      <div style={{ marginBottom: '10px', display: 'flex', gap: '20px' }}>
        <span>카메라 상태: {isLoading ? '로딩중...' : isStreaming ? '실행중' : '중지됨'}</span>
        <span>웹소켓 상태: {webSocketStatus}</span>
      </div>
      {error && <p style={{ color: 'red' }}>⚠️ 오류: {error}</p>}

      {/* 비디오 및 캔버스 영역 */}
      <div style={{ position: 'relative', width: '1200px', height: '720px', border: '1px solid grey', background: '#eee' }}>
        <video ref={videoRef} width="1200" height="720" playsInline style={{ display: 'block', width: '100%', height: '100%' }} />
        <canvas ref={canvasRef} width="1200" height="720" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
        {/* 대기 메시지 */}
        {!isStreaming && !error && !isLoading && webSocketStatus !== 'Connecting' &&(
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'grey', zIndex: 1 }}>
            감지 시작 버튼을 눌러주세요.
          </div>
        )}
        {isLoading && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1 }}>⏳ 로딩 중...</div>}
      </div>

      {/* 컨트롤 버튼 */}
      <div style={{ marginTop: '10px' }}>
        <button onClick={startStreaming} disabled={isStreaming || isLoading || webSocketStatus === 'Connecting'}> 감지 시작 </button>
        <button onClick={stopStreaming} disabled={!isStreaming && webSocketStatus === 'Disconnected'} style={{ marginLeft: '10px' }}> 감지 중지 </button>
      </div>
    </div>
  );
});

export default FallDetectionCam;