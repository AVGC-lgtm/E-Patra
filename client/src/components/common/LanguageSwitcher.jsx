import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const LanguageSwitcher = () => {
  const { language, changeLanguage } = useLanguage();

  return (
    <div className="flex items-center mr-4">
      <button
        onClick={() => changeLanguage('en')}
        className={`px-2 py-1 text-sm rounded-l-md ${language === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        title="English"
      >
        EN
      </button>
      <button
        onClick={() => changeLanguage('mr')}
        className={`px-2 py-1 text-sm rounded-r-md ${language === 'mr' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        title="मराठी"
      >
        मरा
      </button>
    </div>
  );
};

export default LanguageSwitcher;
