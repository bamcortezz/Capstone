import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Swal from 'sweetalert2';

const Settings = () => {
  const { user, updateProfile, updateProfileImage, removeProfileImage } = useAuth();
  const [previewImage, setPreviewImage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const fileInputRef = useRef(null);
  
  // Profile form state
  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || ''
  });

  // Set preview image from user data if it exists
  useEffect(() => {
    if (user?.profile_image) {
      setPreviewImage(user.profile_image);
    }
  }, [user?.profile_image]);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleProfileSave = async () => {
    try {
      // Validate required fields
      if (!profileForm.first_name.trim() || !profileForm.last_name.trim() || !profileForm.email.trim()) {
        await Swal.fire({
          icon: 'error',
          title: 'Required Fields',
          text: 'Please fill in all required fields',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 1000,
          timerProgressBar: true
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(profileForm.email.trim())) {
        await Swal.fire({
          icon: 'error',
          title: 'Invalid Email',
          text: 'Please enter a valid email address',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 1000,
          timerProgressBar: true
        });
        return;
      }

      setIsProfileSaving(true);
      await updateProfile(profileForm);
      
      await Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Profile information updated successfully',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1000,
        timerProgressBar: true
      });
    } catch (error) {
      console.error('Error saving profile information:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.message || 'Failed to update profile information',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1000,
        timerProgressBar: true
      });
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        Swal.fire({
          icon: 'error',
          title: 'File too large',
          text: 'File size should not exceed 5MB',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 1000,
          timerProgressBar: true
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateProfileImage(previewImage);
      
      await Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Profile image updated successfully',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1000,
        timerProgressBar: true
      });
    } catch (error) {
      console.error('Error saving profile image:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.message || 'Failed to update profile image',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1000,
        timerProgressBar: true
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveImage = async () => {
    try {
      const result = await Swal.fire({
        title: 'Remove Profile Image?',
        text: 'Are you sure you want to remove your profile image?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#9147ff',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, remove it!'
      });

      if (result.isConfirmed) {
        setIsRemoving(true);
        await removeProfileImage();
        setPreviewImage(null);
        
        await Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Profile image removed successfully',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 1000,
          timerProgressBar: true
        });
      }
    } catch (error) {
      console.error('Error removing profile image:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.message || 'Failed to remove profile image',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1000,
        timerProgressBar: true
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const hasProfileChanges = 
    profileForm.first_name !== user?.first_name ||
    profileForm.last_name !== user?.last_name ||
    profileForm.email !== user?.email;

  return (
    <div className="min-h-screen bg-black py-12 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-4">Settings</h1>
          <p className="text-gray-400">Manage your account settings and preferences</p>
        </div>

        {/* Settings Sections */}
        <div className="space-y-8">
          {/* Profile Image Section */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Profile Image</h2>
              {previewImage && previewImage !== user?.profile_image && (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-twitch hover:bg-twitch-dark text-white rounded-md transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              )}
            </div>
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                  {previewImage ? (
                    <img 
                      src={previewImage} 
                      alt="Profile Preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-twitch flex items-center justify-center">
                      <span className="text-white text-4xl font-medium">
                        {user?.first_name?.[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleUploadClick}
                  disabled={isSaving || isRemoving}
                  className="absolute bottom-0 right-0 bg-twitch hover:bg-twitch-dark text-white p-2 rounded-full shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
                disabled={isSaving || isRemoving}
              />
              <div className="flex flex-col items-center space-y-2">
                <p className="text-sm text-gray-400">
                  Upload a profile picture (max 5MB)
                </p>
                {previewImage && (
                  <div className="flex space-x-4">
                    {previewImage !== user?.profile_image && (
                      <button
                        onClick={() => setPreviewImage(user?.profile_image || null)}
                        disabled={isSaving || isRemoving}
                        className="text-red-500 hover:text-red-400 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel Changes
                      </button>
                    )}
                    <button
                      onClick={handleRemoveImage}
                      disabled={isSaving || isRemoving}
                      className="text-red-500 hover:text-red-400 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRemoving ? 'Removing...' : 'Remove Image'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Profile Section */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Profile Information</h2>
              {hasProfileChanges && (
                <button
                  onClick={handleProfileSave}
                  disabled={isProfileSaving}
                  className="px-4 py-2 bg-twitch hover:bg-twitch-dark text-white rounded-md transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProfileSaving ? (
                    <>
                      <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={profileForm.first_name}
                  onChange={handleProfileChange}
                  disabled={isProfileSaving}
                  required
                  className="w-full px-4 py-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-twitch focus:ring-1 focus:ring-twitch disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={profileForm.last_name}
                  onChange={handleProfileChange}
                  disabled={isProfileSaving}
                  required
                  className="w-full px-4 py-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-twitch focus:ring-1 focus:ring-twitch disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={profileForm.email}
                  onChange={handleProfileChange}
                  disabled={isProfileSaving}
                  required
                  className="w-full px-4 py-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-twitch focus:ring-1 focus:ring-twitch disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings; 