import React from 'react';
import BaseLetterComponent from './BaseLetterComponent';

const PoliceLetters = () => {
  return (
    <BaseLetterComponent 
      role="police"
      apiEndpoint="/api/patras/police"
      additionalColumns={[
        { key: 'station', label: 'Police Station' },
        { key: 'caseNumber', label: 'Case Number' }
      ]}
    />
  );
};

export default PoliceLetters;
