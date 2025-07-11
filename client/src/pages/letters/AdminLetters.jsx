import React from 'react';
import BaseLetterComponent from './BaseLetterComponent';
import { useLanguage } from '../../context/LanguageContext';
import translations from '../../translations';

const AdminLetters = () => {
  const { language } = useLanguage();
  const t = translations[language] || translations['en'];
  
  // Additional columns specific to admin
  const additionalColumns = [
    {
      key: 'assignedTo',
      header: language === 'mr' ? 'नियुक्त केले' : 'Assigned To',
      render: (letter) => letter.assignedTo || 'N/A'
    },
    {
      key: 'priority',
      header: language === 'mr' ? 'प्राधान्य' : 'Priority',
      render: (letter) => (
        <span className={`px-2 py-1 rounded-full text-xs ${
          letter.priority === 'high' ? 'bg-red-100 text-red-800' :
          letter.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {letter.priority ? letter.priority.charAt(0).toUpperCase() + letter.priority.slice(1) : 'N/A'}
        </span>
      )
    },
    {
      key: 'actionRequired',
      header: language === 'mr' ? 'कृती आवश्यक' : 'Action Required',
      render: (letter) => letter.actionRequired || 'N/A'
    }
  ];

  return (
    <BaseLetterComponent
      role="admin"
      apiEndpoint="http://localhost:5000/api/patras/admin"
      additionalColumns={additionalColumns}
    />
  );
};

export default AdminLetters;
