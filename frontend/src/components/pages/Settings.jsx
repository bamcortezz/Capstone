import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Swal from 'sweetalert2';

const Settings = () => {
  const { user, updateProfile, updateProfileImage, removeProfileImage, changePassword, deleteAccount } = useAuth();
  const [previewImage, setPreviewImage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const fileInputRef = useRef(null);
  
  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || ''
  });

  const [changePasswordForm, setChangePasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [deleteAccountForm, setDeleteAccountForm] = useState({
    password: '',
    confirmPassword: ''
  });

  const [activeSection, setActiveSection] = useState('profile');

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [showDeleteConfirmPassword, setShowDeleteConfirmPassword] = useState(false);

  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

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
          timerProgressBar: true,
          background: '#18181b',
          color: '#fff'
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
          timerProgressBar: true,
          background: '#18181b',
          color: '#fff'
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
        timerProgressBar: true,
        background: '#18181b',
        color: '#fff'
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
        timerProgressBar: true,
        background: '#18181b',
        color: '#fff'
      });
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { 
        Swal.fire({
          icon: 'error',
          title: 'File too large',
          text: 'File size should not exceed 5MB',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 1000,
          timerProgressBar: true,
          background: '#18181b',
          color: '#fff'
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
        timerProgressBar: true,
        background: '#18181b',
        color: '#fff'
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
        timerProgressBar: true,
        background: '#18181b',
        color: '#fff'
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
        confirmButtonText: 'Yes, remove it!',
        background: '#18181b',
        color: '#fff'
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
          timerProgressBar: true,
          background: '#18181b',
          color: '#fff'
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
        timerProgressBar: true,
        background: '#18181b',
        color: '#fff'
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const hasProfileChanges = 
    profileForm.first_name !== user?.first_name ||
    profileForm.last_name !== user?.last_name ||
    profileForm.email !== user?.email;

  const handleChangePasswordInput = (e) => {
    const { name, value } = e.target;
    setChangePasswordForm((prev) => ({ ...prev, [name]: value }));
  };
  const handleDeleteAccountInput = (e) => {
    const { name, value } = e.target;
    setDeleteAccountForm((prev) => ({ ...prev, [name]: value }));
  };

  const sidebarBtn = (section) =>
    `w-full text-left px-4 py-2 rounded-lg transition-colors font-medium mb-2 ` +
    (activeSection === section
      ? 'bg-twitch text-white shadow'
      : 'bg-gray-800 text-gray-300 hover:bg-gray-700');

  const handleChangePassword = async () => {
    if (!changePasswordForm.oldPassword || !changePasswordForm.newPassword || !changePasswordForm.confirmPassword) {
      await Swal.fire({
        icon: 'error',
        title: 'Required Fields',
        text: 'Please fill in all password fields',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1200,
        timerProgressBar: true,
        background: '#18181b',
        color: '#fff'
      });
      return;
    }
    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      await Swal.fire({
        icon: 'error',
        title: 'Password Mismatch',
        text: 'New password and confirm password do not match',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1200,
        timerProgressBar: true,
        background: '#18181b',
        color: '#fff'
      });
      return;
    }
    setIsChangingPassword(true);
    try {
      await changePassword(changePasswordForm.oldPassword, changePasswordForm.newPassword);
      await Swal.fire({
        icon: 'success',
        title: 'Password Changed',
        text: 'Your password has been updated successfully',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1200,
        timerProgressBar: true,
        background: '#18181b',
        color: '#fff'
      });
      setChangePasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Failed to change password',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1200,
        timerProgressBar: true,
        background: '#18181b',
        color: '#fff'
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteAccountForm.password || !deleteAccountForm.confirmPassword) {
      await Swal.fire({
        icon: 'error',
        title: 'Required Fields',
        text: 'Please fill in both password fields',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1200,
        timerProgressBar: true,
        background: '#18181b',
        color: '#fff'
      });
      return;
    }
    if (deleteAccountForm.password !== deleteAccountForm.confirmPassword) {
      await Swal.fire({
        icon: 'error',
        title: 'Password Mismatch',
        text: 'Passwords do not match',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1200,
        timerProgressBar: true,
        background: '#18181b',
        color: '#fff'
      });
      return;
    }
    const result = await Swal.fire({
      title: 'Delete Account?',
      text: 'Are you sure you want to delete your account? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#374151',
      confirmButtonText: 'Yes, delete it!',
      background: '#18181b',
      color: '#fff',
      showConfirmButton: true
    });
    if (!result.isConfirmed) return;
    setIsDeletingAccount(true);
    try {
      await deleteAccount(deleteAccountForm.password);
      await Swal.fire({
        icon: 'success',
        title: 'Account Deleted',
        text: 'Your account has been deleted successfully.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
        background: '#18181b',
        color: '#fff'
      });
      window.location.href = '/';
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Failed to delete account',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
        background: '#18181b',
        color: '#fff'
      });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex justify-center items-start py-12 px-4">
      <div className="w-[1000px] bg-black flex flex-col md:flex-row gap-8 p-8 rounded-xl shadow-lg">
        {/* Sidebar */}
        <div className="md:w-1/3 w-full bg-black border border-gray-700 rounded-lg p-6 flex flex-col items-center md:items-stretch">
          {/* User image and name */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden mb-3">
              {previewImage ? (
                <img 
                  src={previewImage} 
                  alt="Profile Preview" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-twitch flex items-center justify-center">
                  <span className="text-white text-3xl font-medium">
                    {user?.first_name?.[0]?.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="text-lg font-semibold text-white">
              {user?.first_name} {user?.last_name}
            </div>
            <div className="text-sm text-gray-400">{user?.email}</div>
          </div>
          {/* Sidebar buttons */}
          <button className={sidebarBtn('profile')} onClick={() => setActiveSection('profile')}>
            Profile
          </button>
          <button className={sidebarBtn('password')} onClick={() => setActiveSection('password')}>
            Change Password
          </button>
          <button className={sidebarBtn('delete')} onClick={() => setActiveSection('delete')}>
            Delete Account
          </button>
        </div>
        {/* Content */}
        <div className="md:w-2/3 w-full space-y-8">
          {activeSection === 'profile' && (
            <>
              {/* Profile Image Section */}
              <div className="bg-black border border-gray-700 rounded-lg p-6 mb-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-white">Profile Image</h2>
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
                {previewImage && previewImage !== user?.profile_image && (
                  <div className="flex justify-end mt-6">
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="px-6 py-3 bg-twitch hover:bg-twitch-dark text-white rounded-md transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
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
                  </div>
                )}
              </div>
              {/* Profile Info Section */}
              <div className="bg-black border border-gray-700 rounded-lg p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-white mb-2">Profile Information</h2>
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
                {hasProfileChanges && (
                  <div className="mt-8">
                    <button
                      onClick={handleProfileSave}
                      disabled={isProfileSaving}
                      className="w-full py-3 bg-twitch hover:bg-twitch-dark text-white rounded-md transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
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
                  </div>
                )}
              </div>
            </>
          )}
          {/* Change Password Section */}
          {activeSection === 'password' && (
            <div className="bg-black border border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Change Password</h2>
              <div className="flex flex-col gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Old Password</label>
                  <div className="relative">
                    <input
                      type={showOldPassword ? 'text' : 'password'}
                      name="oldPassword"
                      value={changePasswordForm.oldPassword}
                      onChange={handleChangePasswordInput}
                      className="w-full px-4 py-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-twitch focus:ring-1 focus:ring-twitch pr-12"
                      placeholder="Enter your old password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white focus:outline-none"
                      tabIndex={-1}
                    >
                      {showOldPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      name="newPassword"
                      value={changePasswordForm.newPassword}
                      onChange={handleChangePasswordInput}
                      className="w-full px-4 py-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-twitch focus:ring-1 focus:ring-twitch pr-12"
                      placeholder="Enter your new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white focus:outline-none"
                      tabIndex={-1}
                    >
                      {showNewPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={changePasswordForm.confirmPassword}
                      onChange={handleChangePasswordInput}
                      className="w-full px-4 py-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-twitch focus:ring-1 focus:ring-twitch pr-12"
                      placeholder="Confirm your new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white focus:outline-none"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className={`w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center mt-2 bg-twitch hover:bg-twitch-dark text-white ${isChangingPassword ? 'opacity-60 cursor-not-allowed' : ''}`}
                  onClick={handleChangePassword}
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? (
                    <>
                      <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Changing...</span>
                    </>
                  ) : (
                    'Change Password'
                  )}
                </button>
              </div>
            </div>
          )}
          {/* Delete Account Section */}
          {activeSection === 'delete' && (
            <div className="bg-black border border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Delete Account</h2>
              <div className="flex flex-col gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Enter Password</label>
                  <div className="relative">
                    <input
                      type={showDeletePassword ? 'text' : 'password'}
                      name="password"
                      value={deleteAccountForm.password}
                      onChange={handleDeleteAccountInput}
                      className="w-full px-4 py-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-twitch focus:ring-1 focus:ring-twitch pr-12"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeletePassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white focus:outline-none"
                      tabIndex={-1}
                    >
                      {showDeletePassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showDeleteConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={deleteAccountForm.confirmPassword}
                      onChange={handleDeleteAccountInput}
                      className="w-full px-4 py-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-twitch focus:ring-1 focus:ring-twitch pr-12"
                      placeholder="Confirm your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirmPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white focus:outline-none"
                      tabIndex={-1}
                    >
                      {showDeleteConfirmPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className={`w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center mt-2 bg-red-600 hover:bg-red-700 text-white ${isDeletingAccount ? 'opacity-60 cursor-not-allowed' : ''}`}
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount}
                >
                  {isDeletingAccount ? (
                    <>
                      <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    'Delete Account'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings; 