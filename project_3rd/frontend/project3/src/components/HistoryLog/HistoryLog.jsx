// src/components/HistoryLog/HistoryLog.jsx
import React from 'react';
import './HistoryLog.css';
import { API_BASE_URL } from "../../config/constants.js";

function HistoryLog({ title = "감지 기록", history = [], isLoading = false, error = null }) {
  const formatTimestamp = (timestampInput) => {
    if (!timestampInput) return 'N/A';
    try {
      // 입력값이 ISO 8601 형식인지 간단히 확인 (숫자로 시작하고 'T' 포함)
      const isISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(timestampInput);
      let date;
      if (isISO) {
        date = new Date(timestampInput); 
      } else {
        return timestampInput;
      }
      if (isNaN(date.getTime())) {
        return timestampInput; 
      }
      return date.toLocaleString('ko-KR', {
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
      });
    } catch (e) {
      console.error("Timestamp formatting error:", e);
      return timestampInput;
    }
  };
  const renderHistoryEntry = (entry, index) => {
    const isDbRecord = entry.hasOwnProperty('fall_type');
    const key = entry.id || `realtime-${index}`;
    const photoUrl = (isDbRecord && entry.photo_filename)
      ? `${API_BASE_URL}/static/photos/${entry.photo_filename}`
      : null;

    return (
      <li key={key} className="history-entry">
        {/* 공통: 시간 표시 */}
        <span className="history-timestamp">
          <strong>시간:</strong> {formatTimestamp(isDbRecord ? entry.fall_timestamp : entry.timestamp)}
        </span>
        {isDbRecord && (
          <span className="history-fall-type">
            <strong>유형:</strong> {entry.fall_type || 'N/A'}
          </span>
        )}
        {!isDbRecord && (
          <>
            <span className="history-confidence">
              <strong>신뢰도:</strong> {entry.confidence?.toFixed(4) || 'N/A'}
            </span>
            <span className="history-probabilities">
              <strong>확률:</strong> [{entry.probabilities?.map(p => p.toFixed(3)).join(', ') || 'N/A'}]
            </span>
          </>
        )}
        {isDbRecord && entry.phone_number && (
           <span className="history-phone">
             <strong>번호:</strong> {entry.phone_number}
           </span>
         )}
        {photoUrl && (
          <a href={photoUrl} target="_blank" rel="noopener noreferrer" className="photo-link">
             사진 보기
          </a>
        )}
      </li>
    );
  };

  return (
    <div className="history-log-container">
      <h2>{title}</h2>
      {isLoading && <p className="loading-message">기록을 불러오는 중...</p>}
      {error && <p className="error-message">오류 발생: {error}</p>}
      {!isLoading && !error && history.length === 0 && (
        <p className="no-history-message">표시할 기록이 없습니다.</p>
      )}
      {!isLoading && !error && history.length > 0 && (
        <ul className="history-list">
          {history.map(renderHistoryEntry)}
        </ul>
      )}
    </div>
  );
}

export default HistoryLog;