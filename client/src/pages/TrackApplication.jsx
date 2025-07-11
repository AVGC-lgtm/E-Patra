import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import translations from '../translations';
import ReactToPrint from 'react-to-print';

// Print-specific styles
const printStyles = `
  @media print {
    body * {
      visibility: hidden;
    }
    .print-section, .print-section * {
      visibility: visible;
    }
    .print-section {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      padding: 20px;
    }
    .no-print {
      display: none !important;
    }
  }
`;

const TrackApplication = () => {
  const { referenceNumber: refNumber } = useParams();
  const navigate = useNavigate();
  const [referenceNumber, setReferenceNumber] = useState(refNumber || '');
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(!!refNumber);
  const [error, setError] = useState('');
  const { language } = useLanguage();
  const t = translations[language] || translations['en'];
  const printRef = useRef();

  useEffect(() => {
    if (refNumber) {
      setReferenceNumber(refNumber);
      fetchApplication(refNumber);
    } else {
      setApplication(null);
      setLoading(false);
    }
  }, [refNumber]);

  const fetchApplication = async (ref) => {
    if (!ref) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.get(`http://localhost:5000/api/patras?referenceNumber=${ref}`);
      if (response.data && response.data.length > 0) {
        setApplication(response.data[0]);
      } else {
        setError(language === 'mr' ? 'कोणतेही अर्ज सापडले नाहीत' : 'No applications found');
        setApplication(null);
      }
    } catch (err) {
      console.error('Error fetching application:', err);
      setError(language === 'mr' 
        ? 'अर्ज लोड करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा.' 
        : 'Error loading application. Please try again.'
      );
      setApplication(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (referenceNumber.trim()) {
      // Update the URL with the reference number
      navigate(`/dashboard/track-application/${referenceNumber}`);
      // fetchApplication will be triggered by the useEffect
    }
  };

  const getStatusStep = (status) => {
    const statusMap = {
      'pending': 1,
      'in_review': 2,
      'processing': 3,
      'completed': 4
    };
    return statusMap[status?.toLowerCase()] || 0;
  };

  const statusSteps = [
    { id: 'received', label: language === 'mr' ? 'अर्ज प्राप्त' : 'Application Received' },
    { id: 'in_review', label: language === 'mr' ? 'पुनरावलोकनात' : 'In Review' },
    { id: 'processing', label: language === 'mr' ? 'प्रक्रियेत' : 'Processing' },
    { id: 'completed', label: language === 'mr' ? 'पूर्ण' : 'Completed' }
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        {language === 'mr' ? 'अर्ज ट्रॅक करा' : 'Track Application'}
      </h1>
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {language === 'mr' ? 'तुमच्या अर्जाची स्थिती तपासा' : 'Track Your Application Status'}
          </h2>
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              value={referenceNumber || ''}
              onChange={(e) => setReferenceNumber(e.target.value)}
              readOnly={!!refNumber}
              placeholder={language === 'mr' ? 'अर्ज/संदर्भ क्रमांक प्रविष्ट करा' : 'Enter Application/Reference Number'}
              className="flex-1 p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
            />
            <button 
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors"
              disabled={loading}
            >
              {loading 
                ? (language === 'mr' ? 'तपासत आहे...' : 'Checking...') 
                : (language === 'mr' ? 'तपासा' : 'Track')}
            </button>
          </form>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        ) : application ? (
          <>
            {/* Print Section */}
            <div className="hidden">
              <div ref={printRef} className="print-section p-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold">
                    {language === 'mr' ? 'अर्जाची तपशीलवार माहिती' : 'Application Details'}
                  </h2>
                  <div className="border-t-2 border-gray-300 my-3"></div>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  <div className="border-b pb-2 mb-4">
                    <h3 className="font-semibold text-lg mb-3">
                      {language === 'mr' ? 'मूलभूत माहिती' : 'Basic Information'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">
                          {language === 'mr' ? 'संदर्भ क्रमांक' : 'Reference Number'}
                        </p>
                        <p className="font-medium">{application.referenceNumber || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">
                          {language === 'mr' ? 'अर्जाची तारीख' : 'Application Date'}
                        </p>
                        <p className="font-medium">
                          {new Date(application.letterDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">
                          {language === 'mr' ? 'विषय' : 'Subject'}
                        </p>
                        <p className="font-medium">
                          {application.subjectAndDetails?.split(':')[0] || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">
                          {language === 'mr' ? 'स्थिती' : 'Status'}
                        </p>
                        <p className="font-medium capitalize">
                          {application.letterStatus?.toLowerCase() || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {application.subjectAndDetails && (
                    <div className="border-b pb-4 mb-4">
                      <h3 className="font-semibold text-lg mb-2">
                        {language === 'mr' ? 'तपशील' : 'Details'}
                      </h3>
                      <p className="whitespace-pre-line">{application.subjectAndDetails}</p>
                    </div>
                  )}
                </div>
                
                <div className="mt-8 pt-4 border-t text-center text-sm text-gray-500">
                  {language === 'mr' 
                    ? 'ही एक स्वयंचलितपणे व्यवस्थापित प्रत आहे, कृपया यास मुद्रित दस्तऐवज म्हणून वापरा.'
                    : 'This is an automatically generated document, please use as a printed copy.'
                  }
                </div>
              </div>
            </div>
            
            {/* Main Content */}
            <div className="space-y-6">
            {/* Application Details */}
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="font-semibold mb-3">
                {language === 'mr' ? 'अर्जाची माहिती' : 'Application Details'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">
                    {language === 'mr' ? 'संदर्भ क्रमांक' : 'Reference Number'}
                  </p>
                  <p className="font-medium">{application.referenceNumber || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">
                    {language === 'mr' ? 'अर्जाची तारीख' : 'Application Date'}
                  </p>
                  <p className="font-medium">
                    {new Date(application.letterDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">
                    {language === 'mr' ? 'विषय' : 'Subject'}
                  </p>
                  <p className="font-medium">
                    {application.subjectAndDetails?.split(':')[0] || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">
                    {language === 'mr' ? 'स्थिती' : 'Status'}
                  </p>
                  <p className="font-medium capitalize">
                    {application.letterStatus?.toLowerCase() || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Status Timeline */}
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="font-semibold mb-4">
                {language === 'mr' ? 'अर्जाची प्रगती' : 'Application Progress'}
              </h3>
              <div className="space-y-4">
                {statusSteps.map((step, index) => {
                  const currentStep = getStatusStep(application.letterStatus);
                  const isCompleted = index < currentStep;
                  const isCurrent = index === currentStep - 1;
                  
                  return (
                    <div key={step.id} className="flex items-center">
                      <div className={`h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center mr-3 ${
                        isCompleted 
                          ? 'bg-green-100 text-green-600' 
                          : isCurrent 
                            ? 'bg-blue-100 text-blue-600' 
                            : 'bg-gray-100 text-gray-400'
                      }`}>
                        {isCompleted ? (
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <span className="font-medium">{index + 1}</span>
                        )}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${
                          isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-500'
                        }`}>
                          {step.label}
                        </p>
                        {isCurrent && (
                          <p className="text-xs text-blue-600 mt-1">
                            {language === 'mr' 
                              ? 'सध्या प्रक्रियेत आहे' 
                              : 'Currently in progress'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end no-print">
              <ReactToPrint
                trigger={() => (
                  <button 
                    className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    {language === 'mr' ? 'प्रिंट करा' : 'Print'}
                  </button>
                )}
                content={() => printRef.current}
                pageStyle={printStyles}
                documentTitle={`Application_${application?.referenceNumber || 'details'}`}
                onAfterPrint={() => console.log('Print completed')}
              />
            </div>
          </div>
          </>
        ) : (
          <div className="bg-gray-50 p-6 rounded-lg">
            <p className="text-gray-600">
              {language === 'mr' 
                ? 'तुमचा अर्ज/संदर्भ क्रमांक वरून तपासणी करण्यासाठी वर इनपुट करा.' 
                : 'Enter your application/reference number above to check status.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackApplication;
