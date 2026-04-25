import React, { createContext, useMemo, useContext } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
  createUserRequest,
  getUsersRequest,
  assignViewRequest,
  deleteUserRequest,
  resetPasswordRequest,
  setUserStatusRequest,
  getAuditLogRequest,
} from '@/api/enterpriseApi';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const loginStore = useAuthStore((state) => state.login);
  const logoutStore = useAuthStore((state) => state.logout);

  const login = (email, password) => loginStore(email, password);
  const logout = () => logoutStore();

  const getAllUsers = async () => {
    const response = await getUsersRequest();
    return response.users || [];
  };

  const addUser = async (email, password, viewNames = [], role = 'user', databases = ['MEN_MATERIAL']) => {
    const response = await createUserRequest({
      email,
      password,
      role,
      views: viewNames,
      databases,
    });

    return response.user;
  };

  const updateUserViewAssignments = async (email, viewNames, databases = ['MEN_MATERIAL']) => {
    const response = await assignViewRequest({
      email,
      views: viewNames,
      databases,
    });

    return response.user;
  };

  const deleteUser = async (email) => {
    const response = await deleteUserRequest(email);
    return response.user;
  };

  const resetPassword = async (email, newPassword) => {
    const response = await resetPasswordRequest({ email, newPassword });
    return response.user;
  };

  const setUserStatus = async (email, enabled) => {
    const response = await setUserStatusRequest({ email, enabled });
    return response.user;
  };

  const getAuditLog = async (limit = 100) => {
    const response = await getAuditLogRequest(limit);
    return response.events || [];
  };

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    logout,
    addUser,
    getAllUsers,
    updateUserViewAssignments,
    deleteUser,
    resetPassword,
    setUserStatus,
    getAuditLog,
  }), [user, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
