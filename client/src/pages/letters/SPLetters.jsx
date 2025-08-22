import React from 'react';
import BaseLetterComponent from './BaseLetterComponent';

const SPLetters = () => {
  return (
    <BaseLetterComponent 
      role="sp"
      apiEndpoint="/api/patras/sp"
      additionalColumns={[
        { key: 'sender', label: 'Sender' },
        { key: 'priority', label: 'Priority' }
      ]}
    />
  );
};

export default SPLetters;
