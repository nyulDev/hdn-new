import { fetchApi } from '../api';

export interface Customer {
  id: string; // kode e.g. CUST-001
  pt: string;
  namaKapal: string;
  kontak: string;
  alamat: string;
  createdAt: string;
}

export type CreateCustomerData = Omit<Customer, 'id' | 'createdAt'>;
export type UpdateCustomerData = Omit<Customer, 'id' | 'createdAt'>;

export const getCustomers = () => {
  return fetchApi<Customer[]>('/customers');
};

export const createCustomer = (data: CreateCustomerData) => {
  return fetchApi<Customer>('/customers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updateCustomer = (id: string, data: UpdateCustomerData) => {
  return fetchApi<Customer>(`/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteCustomer = (id: string) => {
  return fetchApi<{ success: boolean }>(`/customers/${id}`, {
    method: 'DELETE',
  });
};
