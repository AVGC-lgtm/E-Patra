import React from 'react';
import BaseLetterComponent from './BaseLetterComponent';

const HODLetters = () => {
  return (
    <BaseLetterComponent 
      role="hod"
      apiEndpoint="/api/patras/hod"
      additionalColumns={[
        { key: 'department', label: 'Department' },
        { key: 'actionRequired', label: 'Action Required' }
      ]}
    />
  );
};

export default HODLetters;
