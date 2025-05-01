// src/pages/HistoryLookupPage.jsx
import React, { useState, useEffect, useCallback } from 'react'; 
import HistoryLog from '../components/HistoryLog/HistoryLog';
import { API_BASE_URL } from '../config/constants'; 


// phoneNumber prop을 받도록 수정
function HistoryLookupPage({ phoneNumber }) {
  const [specificFallHistory, setSpecificFallHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // 기록 조회 함수
  const fetchHistory = useCallback(async (numberToLookup) => {
    if (!numberToLookup) return; 
    setIsLoadingHistory(true);
    setFetchError(null);
    setSpecificFallHistory([]);

    try {
      const response = await fetch(`${API_BASE_URL}/fall-events/${numberToLookup}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: '알 수 없는 오류' }));
        throw new Error(errorData.detail || `HTTP 오류 상태: ${response.status}`);
      }
      const data = await response.json();
      setSpecificFallHistory(data);
    } catch (error) {
      console.error("Error fetching fall history:", error);
      setFetchError(error.message);
      setSpecificFallHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []); 
  
  useEffect(() => {
    fetchHistory(phoneNumber);
  }, [phoneNumber, fetchHistory]); 

  return (
    <div>
      <h2>{phoneNumber ? `${phoneNumber} 님의 낙상 기록` : '기록 조회'}</h2>
      {!phoneNumber && <p>기록을 조회할 전화번호가 등록되지 않았습니다.</p>}
      {phoneNumber && (
        <HistoryLog
          history={specificFallHistory}
          isLoading={isLoadingHistory}
          error={fetchError}
        />
      )}
    </div>
  );
}

export default HistoryLookupPage;