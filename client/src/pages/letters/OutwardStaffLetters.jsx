import React from 'react';
import BaseLetterComponent from './BaseLetterComponent';
import { useLanguage } from '../../context/LanguageContext';
import translations from '../../translations';

const OutwardStaffLetters = () => {
  const { language } = useLanguage();
  const t = translations[language] || translations['en'];
  
  // Additional columns specific to outward staff
  const additionalColumns = [
    {
      key: 'recipientDepartment',
      header: language === 'mr' ? 'प्राप्तकर्ता विभाग' : 'Recipient Department',
      render: (letter) => letter.recipientDepartment || 'N/A'
    },
    {
      key: 'dispatchedDate',
      header: language === 'mr' ? 'पाठवणी तारीख' : 'Dispatched Date',
      render: (letter) => letter.dispatchedDate 
        ? new Date(letter.dispatchedDate).toLocaleDateString() 
        : 'N/A'
    },
    {
      key: 'dispatchMode',
      header: language === 'mr' ? 'पाठवणी पद्धत' : 'Dispatch Mode',
      render: (letter) => letter.dispatchMode || 'N/A'
    }
  ];

  return (
    <BaseLetterComponent
      role="outward_staff"
      apiEndpoint="http://localhost:5000/api/patras"
      additionalColumns={additionalColumns}
    />
  );
};

export default OutwardStaffLetters;
