import React from 'react';
import Swal from 'sweetalert2';

const NavigationConfirmationModal = {
  // Show confirmation modal when user tries to navigate away during analysis
  showNavigationConfirmation: async (isLoggedIn = false) => {
    const alertOptions = isLoggedIn ? {
      title: 'Leave Analysis?',
      text: 'You are currently analyzing a channel. What would you like to do with your analysis data?',
      icon: 'warning',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Save & Leave',
      denyButtonText: 'Discard & Leave',
      cancelButtonText: 'Stay Here',
      confirmButtonColor: '#9147ff',
      denyButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      background: '#18181b',
      color: '#fff',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showCloseButton: false
    } : {
      title: 'Leave Analysis?',
      text: 'You are currently analyzing a channel. Are you sure you want to leave?',
      icon: 'warning',
      showDenyButton: true,
      showCancelButton: true,
      showConfirmButton: false,
      denyButtonText: 'Leave',
      cancelButtonText: 'Stay Here',
      denyButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      background: '#18181b',
      color: '#fff',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showCloseButton: false
    };

    const result = await Swal.fire(alertOptions);
    
    return {
      shouldLeave: result.isConfirmed || result.isDenied,
      shouldSave: result.isConfirmed,
      shouldDiscard: result.isDenied
    };
  },

  // Show confirmation modal when user tries to logout during analysis
  showLogoutConfirmation: async (isLoggedIn = false) => {
    const alertOptions = isLoggedIn ? {
      title: 'Logout During Analysis?',
      text: 'You are currently analyzing a channel. What would you like to do with your analysis data before logging out?',
      icon: 'warning',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Save & Logout',
      denyButtonText: 'Discard & Logout',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#9147ff',
      denyButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      background: '#18181b',
      color: '#fff',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showCloseButton: false
    } : {
      title: 'Logout During Analysis?',
      text: 'You are currently analyzing a channel. Are you sure you want to logout?',
      icon: 'warning',
      showDenyButton: true,
      showCancelButton: true,
      showConfirmButton: false,
      denyButtonText: 'Logout',
      cancelButtonText: 'Cancel',
      denyButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      background: '#18181b',
      color: '#fff',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showCloseButton: false
    };

    const result = await Swal.fire(alertOptions);
    
    return {
      shouldLogout: result.isConfirmed || result.isDenied,
      shouldSave: result.isConfirmed,
      shouldDiscard: result.isDenied
    };
  },

  // Show success message after saving
  showSaveSuccess: async () => {
    await Swal.fire({
      title: 'Saved!',
      text: 'Analysis has been saved successfully',
      icon: 'success',
      timer: 1500,
      timerProgressBar: true,
      showConfirmButton: false,
      position: 'top-end',
      toast: true,
      confirmButtonColor: '#9147ff',
      background: '#18181b',
      color: '#fff'
    });
  },

  // Show discard message
  showDiscardMessage: async (isLoggedIn = false) => {
    await Swal.fire({
      title: isLoggedIn ? 'Discarded!' : 'Disconnected!',
      text: isLoggedIn ? 'Analysis has been discarded' : 'Disconnected from channel',
      icon: 'info',
      timer: 1500,
      timerProgressBar: true,
      showConfirmButton: false,
      position: 'top-end',
      toast: true,
      confirmButtonColor: '#9147ff',
      background: '#18181b',
      color: '#fff'
    });
  },

  // Show error message
  showError: async (title, message) => {
    await Swal.fire({
      title: title,
      text: message,
      icon: 'error',
      showConfirmButton: true,
      confirmButtonColor: '#EF4444',
      background: '#18181b',
      color: '#fff'
    });
  }
};

export default NavigationConfirmationModal;
