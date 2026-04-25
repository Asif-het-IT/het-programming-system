import { DATABASE_TYPES } from '@/config/columnMapping';

export const COMPANY_DATABASE_PRESETS = [
  {
    name: 'HARISH EXIM TRADING FZC',
    sheet_id: '1jBqNKFffGOqw5lY8dNMBAyQ9-WwQIA_YuO71HtuEnsM',
    tab_name: 'Lace',
    filters: { MARKA_CODE: 'FZC', PRODUCT_CATEGORY: 'Lace' }
  },
  {
    name: 'HARISH EXIM GENERAL TRADING L.L.C',
    sheet_id: '1cY9_ncssoXMX31AXGRoHbMViR1BCkMfsfzpJ85M4nTM',
    tab_name: 'Lace',
    filters: { MARKA_CODE: 'LLC', PRODUCT_CATEGORY: 'Lace' }
  },
  {
    name: 'Ambariyya Global Investment NIG Ltd',
    sheet_id: '1jBqNKFffGOqw5lY8dNMBAyQ9-WwQIA_YuO71HtuEnsM',
    tab_name: 'Lace',
    filters: { MARKA_CODE: 'KKK', PRODUCT_CATEGORY: 'Lace' }
  },
  {
    name: 'Noor Import & Export Ltd',
    sheet_id: '11UtDMrWZM360Z8rwnxmnuz7pHleOh2cNfR-XY_8c4ro',
    tab_name: 'Lace',
    filters: { MARKA_CODE: 'BBB', PRODUCT_CATEGORY: 'Lace' }
  },
  {
    name: 'Dua Trading & General Merchant Ltd',
    sheet_id: '1mrd_ijbzN6J869rlze0q6G6J_qkrQLI2OzWvGugFg3c',
    tab_name: 'Lace',
    filters: { MARKA_CODE: 'LLL', PRODUCT_CATEGORY: 'Lace' }
  },
  {
    name: 'Fazal Investment NIG Ltd',
    sheet_id: '1fK7Xl_39sgArBvunIbB_-Brz8DuZOe0d3YYN8n8sLFI',
    tab_name: 'Lace',
    filters: { MARKA_CODE: 'AAA', PRODUCT_CATEGORY: 'Lace' }
  },
  {
    name: 'ETS Sattar',
    sheet_id: '1Un7rlpk4ylWcRWRFif2rj-NVjpn2yYv5TPAtkU0WGII',
    tab_name: 'Lace',
    filters: { MARKA_CODE: 'SSS', PRODUCT_CATEGORY: 'Lace' }
  },
  {
    name: 'Fashion Fusion',
    sheet_id: '1F0LUzw7XhGa3FqZT_G6HhWqajsesxi1fO-lSWgajRvo',
    tab_name: 'Lace',
    filters: { MARKA_CODE: 'FFF', PRODUCT_CATEGORY: 'Lace' }
  },
  {
    name: 'Hope Textile Cameroon SARL',
    sheet_id: '18WGtBS_bgqBBqiKsmoiBfh7egwteRXvjJUecka1A2Q4',
    tab_name: 'Lace',
    filters: { MARKA_CODE: 'CCC', PRODUCT_CATEGORY: 'Lace' }
  },
  {
    name: 'Salam Textiles',
    sheet_id: '19e2HLwAy-yg6VABQIBY1ZTvwBY75V50o5ZuLzgk1sSE',
    tab_name: 'Lace',
    filters: { MARKA_CODE: 'MMM', PRODUCT_CATEGORY: 'Lace' }
  },
  {
    name: 'World Textile Sarl',
    sheet_id: '1wBpcenfn5sqsLAkAW15Jwi-enpelROzGi7_kzFadxM8',
    tab_name: 'Lace',
    filters: { MARKA_CODE: 'TTT', PRODUCT_CATEGORY: 'Lace' }
  }
];

export const DEFAULT_VIEW_FIELDS = [
  'sr',
  'order_id',
  'brand',
  'marka',
  'category',
  'status',
  'shipment_status',
  'quantity',
  'contract_date',
  'delivery_date',
  'amount_usd',
  'inv_amount_usd'
];

export const QUICK_TWO_SHEET_PRESETS = [
  {
    name: 'Summary Google Sheet',
    sheet_id: '1WjbvlRbd3AMfe5jE0oMuYxE7W7ARH8xO6BWBZgLivZQ',
    tab_name: 'DATA'
  },
  {
    name: 'Brand Wise Google Sheet',
    sheet_id: '11s0PyuXO5Zn0vBQ4xs3dOvnR-9mp6bJit9GQyjiYD5g',
    tab_name: 'DATA'
  }
];

export const QUICK_THREE_SHEET_PRESETS = [
  {
    name: 'Ambariyya Global Investment NIG Ltd',
    sheet_id: '1jBqNKFffGOqw5lY8dNMBAyQ9-WwQIA_YuO71HtuEnsM',
    tab_name: 'Database'
  },
  {
    name: 'Noor Import & Export Ltd',
    sheet_id: '11UtDMrWZM360Z8rwnxmnuz7pHleOh2cNfR-XY_8c4ro',
    tab_name: 'Database'
  },
  {
    name: 'Fazal Investment NIG Ltd',
    sheet_id: '1fK7Xl_39sgArBvunIbB_-Brz8DuZOe0d3YYN8n8sLFI',
    tab_name: 'Database'
  }
];

export const CORE_THREE_COMPANY_VIEW_PRESETS = [
  {
    name: 'Ambariyya - Gayle',
    marka_code: 'KKK',
    product_category: 'Gayle'
  },
  {
    name: 'Ambariyya - Lace',
    marka_code: 'KKK',
    product_category: 'Lace'
  },
  {
    name: 'Noor - Gayle',
    marka_code: 'BBB',
    product_category: 'Gayle'
  },
  {
    name: 'Noor - Lace',
    marka_code: 'BBB',
    product_category: 'Lace'
  },
  {
    name: 'Fazal - Gayle',
    marka_code: 'AAA',
    product_category: 'Gayle'
  },
  {
    name: 'Fazal - Lace',
    marka_code: 'AAA',
    product_category: 'Lace'
  }
];

export const TWO_DATABASE_TYPE_PRESETS = [
  {
    name: 'Men Material (Production)',
    sheet_id: '',
    tab_name: 'Database',
    sheet_key: 'men_material_master_database',
    type: DATABASE_TYPES.MEN_MATERIAL
  },
  {
    name: 'Gayle/Lace (Factory)',
    sheet_id: '',
    tab_name: 'Database',
    sheet_key: 'primary_database',
    type: DATABASE_TYPES.GAYLE_LACE
  }
];

export const TWO_DATABASE_VIEW_PRESETS = [
  {
    name: 'Men Material - Marka Wise',
    fields: ['sr', 'brand', 'marka', 'category', 'quantity', 'status', 'shipment_status'],
    filters: {}
  },
  {
    name: 'Men Material - Stage Wise',
    fields: ['sr', 'brand', 'marka', 'quantity', 'status', 'shipment_status', 'notes'],
    filters: {}
  },
  {
    name: 'Gayle/Lace - Outlet Wise',
    fields: ['sr', 'brand', 'category', 'marka', 'assigned_to', 'quantity', 'status'],
    filters: {}
  },
  {
    name: 'Gayle Only',
    fields: ['sr', 'brand', 'category', 'marka', 'quantity', 'status', 'shipment_status'],
    filters: { PRODUCT_CATEGORY: 'Gayle' }
  },
  {
    name: 'Lace Only',
    fields: ['sr', 'brand', 'category', 'marka', 'quantity', 'status', 'shipment_status'],
    filters: { PRODUCT_CATEGORY: 'Lace' }
  },
  {
    name: 'Gayle/Lace - Stage Wise',
    fields: ['sr', 'brand', 'category', 'marka', 'quantity', 'status', 'shipment_status'],
    filters: {}
  }
];

export const EXTERNAL_VIEW_PRESETS = [
  {
    name: 'Summary',
    target_url: 'https://docs.google.com/spreadsheets/d/1WjbvlRbd3AMfe5jE0oMuYxE7W7ARH8xO6BWBZgLivZQ/edit?gid=270821011#gid=270821011',
    target_sheet_name: 'DATA',
    columns_list: 'A,B,C,D,J,R,AD'
  },
  {
    name: 'Brand Wise Report',
    target_url: 'https://docs.google.com/spreadsheets/d/11s0PyuXO5Zn0vBQ4xs3dOvnR-9mp6bJit9GQyjiYD5g/edit?gid=0#gid=0',
    target_sheet_name: 'DATA',
    columns_list: 'A,B,D,E,H,I,J,M,N,S,T,AY'
  },
  {
    name: 'Management Report',
    target_url: 'https://docs.google.com/spreadsheets/d/1ZsU_QXWH0ooVnCk-lb3d4SYqvT9oZiPBJl5o1bHq1KI/edit?gid=887481872#gid=887481872',
    target_sheet_name: 'DATA',
    columns_list: 'A,B,D,E,F,G,H,I,J,M,N,O,P,S,T,U,AY'
  },
  {
    name: 'Programming View',
    target_url: 'https://docs.google.com/spreadsheets/d/1jBqNKFffGOqw5lY8dNMBAyQ9-WwQIA_YuO71HtuEnsM/edit?gid=0#gid=0',
    target_sheet_name: 'MEN MATERIAL',
    columns_list: 'A,B,C,D,E,H,J,K,L,M,N,Q,R,S,T,U,AD,AK,AL,AM,AN,AO,AP,AR,AS,AT,AU,AV,AW,AX,AY'
  },
  {
    name: 'Fazal View',
    target_url: 'https://docs.google.com/spreadsheets/d/1fK7Xl_39sgArBvunIbB_-Brz8DuZOe0d3YYN8n8sLFI/edit?gid=0#gid=0',
    target_sheet_name: 'MEN MATERIAL',
    columns_list: 'A,B,C,D,E,H,J,K,L,M,N,Q,R,S,T,U,AD,AM,AN,AY'
  },
  {
    name: 'Dua View',
    target_url: 'https://docs.google.com/spreadsheets/d/1mrd_ijbzN6J869rlze0q6G6J_qkrQLI2OzWvGugFg3c/edit?gid=0#gid=0',
    target_sheet_name: 'MEN MATERIAL',
    columns_list: 'A,B,C,D,E,H,J,K,L,M,N,Q,R,S,T,U,AD,AM,AN,AW,AX,AY'
  },
  {
    name: 'Sattar View',
    target_url: 'https://docs.google.com/spreadsheets/d/1Un7rlpk4ylWcRWRFif2rj-NVjpn2yYv5TPAtkU0WGII/edit?gid=0#gid=0',
    target_sheet_name: 'MEN MATERIAL',
    columns_list: 'A,B,C,D,E,H,J,K,L,M,N,Q,R,S,T,U,AD,AO,AP,AY'
  },
  {
    name: 'Dxb View',
    target_url: 'https://docs.google.com/spreadsheets/d/1cY9_ncssoXMX31AXGRoHbMViR1BCkMfsfzpJ85M4nTM/edit?gid=0#gid=0',
    target_sheet_name: 'MEN MATERIAL',
    columns_list: 'A,B,C,D,E,H,J,K,L,M,N,Q,R,S,T,U,AD,AK,AL,AY'
  },
  {
    name: 'Salam View',
    target_url: 'https://docs.google.com/spreadsheets/d/19e2HLwAy-yg6VABQIBY1ZTvwBY75V50o5ZuLzgk1sSE/edit?gid=0#gid=0',
    target_sheet_name: 'MEN MATERIAL',
    columns_list: 'A,B,C,D,E,H,J,K,L,M,N,Q,R,S,T,U,AD,AO,AP,AS,AT,AY'
  },
  {
    name: 'World View',
    target_url: 'https://docs.google.com/spreadsheets/d/1wBpcenfn5sqsLAkAW15Jwi-enpelROzGi7_kzFadxM8/edit?gid=0#gid=0',
    target_sheet_name: 'MEN MATERIAL',
    columns_list: 'A,B,C,D,E,H,J,K,L,M,N,Q,R,S,T,U,AD,AM,AN,AQ,AR,AY'
  },
  {
    name: 'Noor View',
    target_url: 'https://docs.google.com/spreadsheets/d/11UtDMrWZM360Z8rwnxmnuz7pHleOh2cNfR-XY_8c4ro/edit?gid=0#gid=0',
    target_sheet_name: 'MEN MATERIAL',
    columns_list: 'A,B,C,D,E,H,J,K,L,M,N,Q,R,S,T,U,AD,AM,AN,AY'
  },
  {
    name: 'Hope View',
    target_url: 'https://docs.google.com/spreadsheets/d/18WGtBS_bgqBBqiKsmoiBfh7egwteRXvjJUecka1A2Q4/edit?gid=0#gid=0',
    target_sheet_name: 'MEN MATERIAL',
    columns_list: 'A,B,C,D,E,H,J,K,L,M,N,Q,R,S,T,U,AD,AM,AN,AU,AV,AY'
  },
  {
    name: 'Fashion Fusion View',
    target_url: 'https://docs.google.com/spreadsheets/d/1F0LUzw7XhGa3FqZT_G6HhWqajsesxi1fO-lSWgajRvo/edit?gid=0#gid=0',
    target_sheet_name: 'MEN MATERIAL',
    columns_list: 'A,B,C,D,E,H,J,K,L,M,N,Q,R,S,T,U,AD,AM,AN,AQ,AR,AY'
  }
];
