import React from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigationBlock } from '../hooks/useNavigationBlock';

const ProtectedNavigationRoute = ({ children }) => {
  const location = useLocation();
  const { isAnalyzing } = useNavigationBlock();

  // If not analyzing, render children normally
  if (!isAnalyzing) {
    return children;
  }

  // If analyzing, the navigation blocking is handled by the useNavigationBlock hook
  // which will show confirmation modals when navigation is attempted
  return children;
};

export default ProtectedNavigationRoute;
