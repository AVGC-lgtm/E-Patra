import React from 'react';
import { useLanguage } from '../context/LanguageContext';

const LanguageSelector = () => {
  const { language, changeLanguage } = useLanguage();

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={() => changeLanguage('en')}
        className={`px-2 py-1 rounded ${language === 'en' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
      >
        EN
      </button>
      <button
        onClick={() => changeLanguage('mr')}
        className={`px-2 py-1 rounded ${language === 'mr' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
      >
        मराठी
      </button>
    </div>
  );
};

export default LanguageSelector;
