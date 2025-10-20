import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [profiles, setProfiles] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [stats, setStats] = useState({});
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showCertForm, setShowCertForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [certPemData, setCertPemData] = useState('');
  const [parsedCert, setParsedCert] = useState(null);
  const [importMethod, setImportMethod] = useState('text');
  const [importText, setImportText] = useState('');
  const [scannedProfiles, setScannedProfiles] = useState([]);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      const [profilesRes, certsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/profiles`),
        axios.get(`${API_URL}/api/certificates`),
        axios.get(`${API_URL}/api/stats`)
      ]);
      setProfiles(profilesRes.data);
      setCertificates(certsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const profileData = {
      name: formData.get('name'),
      iccid: formData.get('iccid'),
      imsi: formData.get('imsi'),
      ki: formData.get('ki'),
      opc: formData.get('opc'),
      standard: formData.get('standard'),
      status: 'disabled'
    };

    try {
      if (editingProfile) {
        await axios.put(`${API_URL}/api/profiles/${editingProfile.id}`, profileData);
      } else {
        await axios.post(`${API_URL}/api/profiles`, profileData);
      }
      setShowProfileForm(false);
      setEditingProfile(null);
      fetchData();
    } catch (error) {
      alert('Error saving profile: ' + error.response?.data?.detail);
    }
  };

  const handleDeleteProfile = async (id) => {
    if (window.confirm('Are you sure you want to delete this profile?')) {
      try {
        await axios.delete(`${API_URL}/api/profiles/${id}`);
        fetchData();
      } catch (error) {
        alert('Error deleting profile');
      }
    }
  };

  const handleToggleProfile = async (profile) => {
    try {
      if (profile.status === 'enabled') {
        await axios.post(`${API_URL}/api/profiles/${profile.id}/disable`);
      } else {
        await axios.post(`${API_URL}/api/profiles/${profile.id}/enable`);
      }
      fetchData();
    } catch (error) {
      alert('Error toggling profile status');
    }
  };

  const handleParseCertificate = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/certificates/parse`, {
        pem_data: certPemData
      });
      setParsedCert(response.data);
    } catch (error) {
      alert('Error parsing certificate: ' + error.response?.data?.detail);
    }
  };

  const handleSaveCertificate = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const certData = {
      name: formData.get('name'),
      issuer: formData.get('issuer'),
      subject: formData.get('subject'),
      serial_number: formData.get('serial_number'),
      not_before: formData.get('not_before'),
      not_after: formData.get('not_after'),
      key_id: formData.get('key_id'),
      crl_url: formData.get('crl_url'),
      standard: formData.get('standard'),
      pem_data: certPemData
    };

    try {
      await axios.post(`${API_URL}/api/certificates`, certData);
      setShowCertForm(false);
      setCertPemData('');
      setParsedCert(null);
      fetchData();
    } catch (error) {
      alert('Error saving certificate');
    }
  };

  const handleDeleteCertificate = async (id) => {
    if (window.confirm('Are you sure you want to delete this certificate?')) {
      try {
        await axios.delete(`${API_URL}/api/certificates/${id}`);
        fetchData();
      } catch (error) {
        alert('Error deleting certificate');
      }
    }
  };

  const handleScanProfiles = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/profiles/scan`, {
        text: importText
      });
      setScannedProfiles(response.data.profiles);
      setImportResult(null);
    } catch (error) {
      alert('Error scanning profiles: ' + error.response?.data?.detail);
    }
  };

  const handleImportScanned = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/profiles/import/text`, {
        profiles: scannedProfiles
      });
      setImportResult(response.data);
      fetchData();
      setTimeout(() => {
        setShowImportModal(false);
        setImportText('');
        setScannedProfiles([]);
        setImportResult(null);
      }, 3000);
    } catch (error) {
      alert('Error importing profiles: ' + error.response?.data?.detail);
    }
  };

  const handleFileImport = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      if (type === 'json') {
        const text = await file.text();
        const jsonData = JSON.parse(text);
        const response = await axios.post(`${API_URL}/api/profiles/import/json`, jsonData);
        setImportResult(response.data);
        fetchData();
      } else if (type === 'csv') {
        const formData = new FormData();
        formData.append('file', file);
        const response = await axios.post(`${API_URL}/api/profiles/import/csv`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setImportResult(response.data);
        fetchData();
      }
      setTimeout(() => setImportResult(null), 5000);
    } catch (error) {
      alert('Error importing file: ' + error.response?.data?.detail);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">eUICC Profile Manager</h1>
              <p className="text-sm text-gray-600 mt-1">Embedded SIM Management System</p>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full">SGP.21</span>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full">SGP.22</span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid="dashboard-tab"
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('profiles')}
              className={`px-3 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'profiles'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid="profiles-tab"
            >
              Profiles
            </button>
            <button
              onClick={() => setActiveTab('certificates')}
              className={`px-3 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'certificates'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid="certificates-tab"
            >
              Certificates
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <div data-testid="dashboard-view">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">System Overview</h2>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="text-sm font-medium text-gray-600 mb-2">Total Profiles</div>
                <div className="text-3xl font-bold text-gray-900">{stats.total_profiles || 0}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="text-sm font-medium text-gray-600 mb-2">Enabled Profiles</div>
                <div className="text-3xl font-bold text-green-600">{stats.enabled_profiles || 0}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="text-sm font-medium text-gray-600 mb-2">Disabled Profiles</div>
                <div className="text-3xl font-bold text-gray-600">{stats.disabled_profiles || 0}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="text-sm font-medium text-gray-600 mb-2">Certificates</div>
                <div className="text-3xl font-bold text-blue-600">{stats.total_certificates || 0}</div>
              </div>
            </div>

            {/* Recent Profiles */}
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Profiles</h3>
              {profiles.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No profiles yet. Create your first profile.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ICCID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Standard</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {profiles.slice(0, 5).map((profile) => (
                        <tr key={profile.id}>
                          <td className="px-4 py-3 text-sm text-gray-900">{profile.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 font-mono">{profile.iccid}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{profile.standard}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              profile.status === 'enabled' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {profile.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'profiles' && (
          <div data-testid="profiles-view">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Profile Management</h2>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  data-testid="import-profiles-btn"
                >
                  Import / Scan Profiles
                </button>
                <button
                  onClick={() => {
                    setShowProfileForm(true);
                    setEditingProfile(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  data-testid="create-profile-btn"
                >
                  Create Profile
                </button>
              </div>
            </div>

            {/* Import Result Banner */}
            {importResult && (
              <div className={`mb-6 p-4 rounded-lg ${importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-green-800">
                      Import Complete: {importResult.imported_count} profiles imported
                    </p>
                    {importResult.skipped_count > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        {importResult.skipped_count} profiles skipped (already exist)
                      </p>
                    )}
                  </div>
                  <button onClick={() => setImportResult(null)} className="text-gray-500 hover:text-gray-700">
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Import / Scan eSIM Profiles</h3>
                    
                    {/* Import Method Selector */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Import Method</label>
                      <div className="flex space-x-4">
                        <button
                          onClick={() => setImportMethod('text')}
                          className={`px-4 py-2 rounded-lg ${importMethod === 'text' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                        >
                          Text Scan
                        </button>
                        <button
                          onClick={() => setImportMethod('json')}
                          className={`px-4 py-2 rounded-lg ${importMethod === 'json' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                        >
                          JSON File
                        </button>
                        <button
                          onClick={() => setImportMethod('csv')}
                          className={`px-4 py-2 rounded-lg ${importMethod === 'csv' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                        >
                          CSV File
                        </button>
                      </div>
                    </div>

                    {/* Text Scan Method */}
                    {importMethod === 'text' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Paste Profile Data (Format: key: value)
                        </label>
                        <textarea
                          value={importText}
                          onChange={(e) => setImportText(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                          rows="10"
                          placeholder="Name: Profile 1&#10;ICCID: 89012345678901234567&#10;IMSI: 310123456789012&#10;Ki: 00112233445566778899AABBCCDDEEFF&#10;OPC: FFEEDDCCBBAA99887766554433221100&#10;Standard: SGP.22&#10;&#10;Name: Profile 2&#10;ICCID: 89445566778899001122&#10;..."
                          data-testid="import-text-input"
                        />
                        <div className="flex space-x-3 mt-4">
                          <button
                            onClick={handleScanProfiles}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            data-testid="scan-profiles-btn"
                          >
                            Scan Profiles
                          </button>
                          {scannedProfiles.length > 0 && (
                            <button
                              onClick={handleImportScanned}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                              data-testid="import-scanned-btn"
                            >
                              Import {scannedProfiles.length} Profile(s)
                            </button>
                          )}
                        </div>

                        {/* Scanned Profiles Preview */}
                        {scannedProfiles.length > 0 && (
                          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">Scanned Profiles Preview</h4>
                            <div className="space-y-3">
                              {scannedProfiles.map((profile, idx) => (
                                <div key={idx} className="p-3 bg-white rounded border border-gray-200 text-xs">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div><span className="font-medium">Name:</span> {profile.name || 'N/A'}</div>
                                    <div><span className="font-medium">ICCID:</span> {profile.iccid}</div>
                                    <div><span className="font-medium">IMSI:</span> {profile.imsi || 'N/A'}</div>
                                    <div><span className="font-medium">Standard:</span> {profile.standard || 'SGP.22'}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* JSON File Method */}
                    {importMethod === 'json' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Upload JSON File
                        </label>
                        <p className="text-xs text-gray-600 mb-3">
                          Format: {"{"}"profiles": [{"{"}"name": "...", "iccid": "...", ...{"}"}]{"}"}
                        </p>
                        <input
                          type="file"
                          accept=".json"
                          onChange={(e) => handleFileImport(e, 'json')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          data-testid="json-file-input"
                        />
                      </div>
                    )}

                    {/* CSV File Method */}
                    {importMethod === 'csv' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Upload CSV File
                        </label>
                        <p className="text-xs text-gray-600 mb-3">
                          Headers: name,iccid,imsi,ki,opc,standard,status
                        </p>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => handleFileImport(e, 'csv')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          data-testid="csv-file-input"
                        />
                      </div>
                    )}

                    <div className="flex justify-end mt-6">
                      <button
                        onClick={() => {
                          setShowImportModal(false);
                          setImportText('');
                          setScannedProfiles([]);
                          setImportResult(null);
                        }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        data-testid="close-import-modal-btn"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Profile Form Modal */}
            {showProfileForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {editingProfile ? 'Edit Profile' : 'Create New Profile'}
                    </h3>
                    <form onSubmit={handleCreateProfile} data-testid="profile-form">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Profile Name</label>
                          <input
                            type="text"
                            name="name"
                            required
                            defaultValue={editingProfile?.name}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            data-testid="profile-name-input"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">ICCID</label>
                          <input
                            type="text"
                            name="iccid"
                            required
                            defaultValue={editingProfile?.iccid}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                            placeholder="89012345678901234567"
                            data-testid="profile-iccid-input"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">IMSI</label>
                          <input
                            type="text"
                            name="imsi"
                            defaultValue={editingProfile?.imsi}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                            placeholder="310123456789012"
                            data-testid="profile-imsi-input"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Ki (128-bit)</label>
                          <input
                            type="text"
                            name="ki"
                            defaultValue={editingProfile?.ki}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                            placeholder="00112233445566778899AABBCCDDEEFF"
                            data-testid="profile-ki-input"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">OPC (128-bit)</label>
                          <input
                            type="text"
                            name="opc"
                            defaultValue={editingProfile?.opc}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                            placeholder="FFEEDDCCBBAA99887766554433221100"
                            data-testid="profile-opc-input"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Standard</label>
                          <select
                            name="standard"
                            defaultValue={editingProfile?.standard || 'SGP.22'}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            data-testid="profile-standard-select"
                          >
                            <option value="SGP.21">SGP.21</option>
                            <option value="SGP.22">SGP.22</option>
                            <option value="SGP.01">SGP.01</option>
                            <option value="SGP.02">SGP.02</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end space-x-3 mt-6">
                        <button
                          type="button"
                          onClick={() => {
                            setShowProfileForm(false);
                            setEditingProfile(null);
                          }}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                          data-testid="cancel-profile-btn"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          data-testid="save-profile-btn"
                        >
                          {editingProfile ? 'Update' : 'Create'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* Profiles List */}
            <div className="bg-white rounded-lg shadow border border-gray-200">
              {profiles.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">No profiles found</p>
                  <button
                    onClick={() => setShowProfileForm(true)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Create your first profile
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ICCID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IMSI</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Standard</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {profiles.map((profile) => (
                        <tr key={profile.id} data-testid={`profile-row-${profile.id}`}>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{profile.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 font-mono">{profile.iccid}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 font-mono">{profile.imsi || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{profile.standard}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              profile.status === 'enabled' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {profile.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm space-x-2">
                            <button
                              onClick={() => handleToggleProfile(profile)}
                              className={`px-3 py-1 rounded text-xs font-medium ${
                                profile.status === 'enabled'
                                  ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                                  : 'bg-green-100 text-green-800 hover:bg-green-200'
                              }`}
                              data-testid={`toggle-profile-${profile.id}`}
                            >
                              {profile.status === 'enabled' ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              onClick={() => {
                                setEditingProfile(profile);
                                setShowProfileForm(true);
                              }}
                              className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium hover:bg-blue-200"
                              data-testid={`edit-profile-${profile.id}`}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteProfile(profile.id)}
                              className="px-3 py-1 bg-red-100 text-red-800 rounded text-xs font-medium hover:bg-red-200"
                              data-testid={`delete-profile-${profile.id}`}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'certificates' && (
          <div data-testid="certificates-view">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Certificate Management</h2>
              <button
                onClick={() => setShowCertForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                data-testid="add-certificate-btn"
              >
                Add Certificate
              </button>
            </div>

            {/* Certificate Form Modal */}
            {showCertForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Certificate</h3>
                    
                    {/* PEM Input and Parser */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Certificate PEM Data</label>
                      <textarea
                        value={certPemData}
                        onChange={(e) => setCertPemData(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        rows="8"
                        placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                        data-testid="cert-pem-input"
                      />
                      <button
                        type="button"
                        onClick={handleParseCertificate}
                        className="mt-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                        data-testid="parse-cert-btn"
                      >
                        Parse Certificate
                      </button>
                    </div>

                    {parsedCert && (
                      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Parsed Certificate Info</h4>
                        <div className="space-y-1 text-xs font-mono">
                          <div><span className="text-gray-600">Issuer:</span> {parsedCert.issuer}</div>
                          <div><span className="text-gray-600">Subject:</span> {parsedCert.subject}</div>
                          <div><span className="text-gray-600">Serial:</span> {parsedCert.serial_number}</div>
                          <div><span className="text-gray-600">Valid From:</span> {parsedCert.not_before}</div>
                          <div><span className="text-gray-600">Valid Until:</span> {parsedCert.not_after}</div>
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleSaveCertificate} data-testid="certificate-form">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Name</label>
                          <input
                            type="text"
                            name="name"
                            required
                            defaultValue={parsedCert?.subject || ''}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            data-testid="cert-name-input"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Issuer</label>
                          <input
                            type="text"
                            name="issuer"
                            required
                            defaultValue={parsedCert?.issuer || ''}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            data-testid="cert-issuer-input"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                          <input
                            type="text"
                            name="subject"
                            required
                            defaultValue={parsedCert?.subject || ''}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            data-testid="cert-subject-input"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                            <input
                              type="text"
                              name="serial_number"
                              required
                              defaultValue={parsedCert?.serial_number || ''}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                              data-testid="cert-serial-input"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Key ID</label>
                            <input
                              type="text"
                              name="key_id"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                              data-testid="cert-keyid-input"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Not Before</label>
                            <input
                              type="text"
                              name="not_before"
                              required
                              defaultValue={parsedCert?.not_before || ''}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              data-testid="cert-notbefore-input"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Not After</label>
                            <input
                              type="text"
                              name="not_after"
                              required
                              defaultValue={parsedCert?.not_after || ''}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              data-testid="cert-notafter-input"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">CRL URL</label>
                          <input
                            type="url"
                            name="crl_url"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="http://gsma-crl.symauth.com/..."
                            data-testid="cert-crl-input"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Standard</label>
                          <select
                            name="standard"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            data-testid="cert-standard-select"
                          >
                            <option value="">Select Standard</option>
                            <option value="SGP.21">SGP.21</option>
                            <option value="SGP.22">SGP.22</option>
                            <option value="SGP.01">SGP.01</option>
                            <option value="SGP.02">SGP.02</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end space-x-3 mt-6">
                        <button
                          type="button"
                          onClick={() => {
                            setShowCertForm(false);
                            setCertPemData('');
                            setParsedCert(null);
                          }}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                          data-testid="cancel-cert-btn"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          data-testid="save-cert-btn"
                        >
                          Save Certificate
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* Certificates List */}
            <div className="bg-white rounded-lg shadow border border-gray-200">
              {certificates.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">No certificates found</p>
                  <button
                    onClick={() => setShowCertForm(true)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Add your first certificate
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {certificates.map((cert) => (
                    <div key={cert.id} className="p-6" data-testid={`cert-item-${cert.id}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{cert.name}</h3>
                          {cert.standard && (
                            <span className="inline-block mt-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                              {cert.standard}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteCertificate(cert.id)}
                          className="px-3 py-1 bg-red-100 text-red-800 rounded text-xs font-medium hover:bg-red-200"
                          data-testid={`delete-cert-${cert.id}`}
                        >
                          Delete
                        </button>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <span className="text-gray-600 font-medium">Issuer:</span>
                            <p className="text-gray-900 mt-1 break-all">{cert.issuer}</p>
                          </div>
                          <div>
                            <span className="text-gray-600 font-medium">Subject:</span>
                            <p className="text-gray-900 mt-1 break-all">{cert.subject}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div>
                            <span className="text-gray-600 font-medium">Serial Number:</span>
                            <p className="text-gray-900 mt-1 font-mono text-xs">{cert.serial_number}</p>
                          </div>
                          {cert.key_id && (
                            <div>
                              <span className="text-gray-600 font-medium">Key ID:</span>
                              <p className="text-gray-900 mt-1 font-mono text-xs">{cert.key_id}</p>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div>
                            <span className="text-gray-600 font-medium">Valid From:</span>
                            <p className="text-gray-900 mt-1">{new Date(cert.not_before).toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-gray-600 font-medium">Valid Until:</span>
                            <p className="text-gray-900 mt-1">{new Date(cert.not_after).toLocaleString()}</p>
                          </div>
                        </div>
                        {cert.crl_url && (
                          <div className="pt-2">
                            <span className="text-gray-600 font-medium">CRL Distribution Point:</span>
                            <p className="text-blue-600 mt-1 break-all">
                              <a href={cert.crl_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {cert.crl_url}
                              </a>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
