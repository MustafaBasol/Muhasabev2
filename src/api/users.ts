import apiClient from './client';

export interface UpdateProfileDto {
  name?: string;
  phone?: string;
}

export const usersApi = {
  /**
   * Mevcut kullanıcının profilini getir
   */
  getProfile: async () => {
    const response = await apiClient.get('/users/me');
    return response.data;
  },

  /**
   * Mevcut kullanıcının profilini güncelle
   */
  updateProfile: async (data: UpdateProfileDto) => {
    const response = await apiClient.put('/users/me', data);
    return response.data;
  },
};
