import React, { createContext, useMemo, useContext } from 'react';
import PropTypes from 'prop-types';
import { useAuthStore } from '@/store/authStore';
import {
  createUserRequest,
  getUsersRequest,
  assignViewRequest,
  updateUserConfigRequest,
  deleteUserRequest,
  resetPasswordRequest,
  setUserStatusRequest,
  getAuditLogRequest,
  getAdminViewsRequest,
  getAdminColumnsRequest,
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

  const addUser = async (email, password, options = {}) => {
    if (email && typeof email === 'object') {
      const legacy = email;
      const response = await createUserRequest({
        email: legacy.email,
        password: legacy.password,
        role: legacy.role || 'user',
        views: legacy.views || [],
        databases: legacy.databases || ['MEN_MATERIAL'],
        permissions: legacy.permissions,
        quota: legacy.quota,
        allowedColumns: legacy.allowedColumns,
        allowedColumnsByView: legacy.allowedColumnsByView,
      });
      return response.user;
    }

    const {
      viewNames = [],
      role = 'user',
      databases = ['MEN_MATERIAL'],
      permissions,
      quota,
      allowedColumns,
      allowedColumnsByView,
    } = options;

    const response = await createUserRequest({
      email,
      password,
      role,
      views: viewNames,
      databases,
      permissions,
      quota,
      allowedColumns,
      allowedColumnsByView,
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

  const updateUserConfig = async (email, payload) => {
    const response = await updateUserConfigRequest(email, payload);
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

  const getAdminViews = async () => {
    const response = await getAdminViewsRequest();
    return response.views || [];
  };

  const getAdminColumns = async (database, view) => {
    const response = await getAdminColumnsRequest({ database, view });
    return response.columns || [];
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
    updateUserConfig,
    deleteUser,
    resetPassword,
    setUserStatus,
    getAuditLog,
    getAdminViews,
    getAdminColumns,
  }), [user, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
