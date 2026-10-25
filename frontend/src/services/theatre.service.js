import api from "./api";

/*
|--------------------------------------------------------------------------
| Operating Theatre Service
|--------------------------------------------------------------------------
| All requests use the shared Axios instance from api.js.
| Authentication and token refresh are handled by api.js.
|
| Backend base URL:
| VITE_API_URL=http://localhost:3000/api
|--------------------------------------------------------------------------
*/

const THEATRE_URL = "/theatre";

/*
|--------------------------------------------------------------------------
| Dashboard
|--------------------------------------------------------------------------
*/

/**
 * Get operating theatre dashboard statistics.
 */
export const getTheatreDashboard = async () => {
  const response = await api.get(`${THEATRE_URL}/dashboard`);
  return response.data;
};

/*
|--------------------------------------------------------------------------
| Theatre Rooms
|--------------------------------------------------------------------------
*/

/**
 * Get all theatre rooms.
 */
export const getTheatreRooms = async (params = {}) => {
  const response = await api.get(`${THEATRE_URL}/rooms`, { params });
  return response.data;
};

/**
 * Create a theatre room.
 */
export const createTheatreRoom = async (roomData) => {
  const response = await api.post(`${THEATRE_URL}/rooms`, roomData);
  return response.data;
};

/**
 * Update a theatre room.
 */
export const updateTheatreRoom = async (roomId, roomData) => {
  const response = await api.patch(
    `${THEATRE_URL}/rooms/${encodeURIComponent(roomId)}`,
    roomData,
  );

  return response.data;
};

/*
|--------------------------------------------------------------------------
| Surgical Procedures
|--------------------------------------------------------------------------
*/

/**
 * Get the available surgical procedures.
 */
export const getSurgicalProcedures = async (params = {}) => {
  const response = await api.get(`${THEATRE_URL}/procedures`, { params });
  return response.data;
};

/**
 * Create a surgical procedure.
 */
export const createSurgicalProcedure = async (procedureData) => {
  const response = await api.post(`${THEATRE_URL}/procedures`, procedureData);

  return response.data;
};

/**
 * Update a surgical procedure.
 */
export const updateSurgicalProcedure = async (procedureId, procedureData) => {
  const response = await api.patch(
    `${THEATRE_URL}/procedures/${encodeURIComponent(procedureId)}`,
    procedureData,
  );

  return response.data;
};

/*
|--------------------------------------------------------------------------
| Surgeries
|--------------------------------------------------------------------------
*/

/**
 * Get scheduled and recorded surgeries.
 */
export const getSurgeries = async (params = {}) => {
  const response = await api.get(`${THEATRE_URL}/surgeries`, { params });
  return response.data;
};

/**
 * Schedule a surgery.
 */
export const createSurgery = async (surgeryData) => {
  const response = await api.post(`${THEATRE_URL}/surgeries`, surgeryData);

  return response.data;
};

/**
 * Update the status of a surgery.
 *
 * Example statuses depend on the backend migration/controller:
 * scheduled, in_progress, completed, cancelled.
 */

export const updateSurgeryStatus = async (surgeryId, status) => {
  const response = await api.patch(
    `${THEATRE_URL}/surgeries/${encodeURIComponent(surgeryId)}/status`,
    { surgery_status: status },
  );

  return response.data;
};

/*
|--------------------------------------------------------------------------
| Operation Records
|--------------------------------------------------------------------------
*/

/**
 * Save or update an operation record.
 */
export const saveOperationRecord = async (recordData) => {
  const response = await api.put(
    `${THEATRE_URL}/surgeries/${encodeURIComponent(recordData.surgeryId)}/record`,
    recordData,
  );

  return response.data;
};

/*
|--------------------------------------------------------------------------
| Error Handling Helper
|--------------------------------------------------------------------------
*/

/**
 * Return a readable API error message.
 */
export const getTheatreErrorMessage = (error) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "An unexpected operating theatre error occurred."
  );
};

/*
|--------------------------------------------------------------------------
| Default Export
|--------------------------------------------------------------------------
| Allows importing all theatre functions through one service object.
*/

const theatreService = {
  getTheatreDashboard,
  getTheatreRooms,
  createTheatreRoom,
  updateTheatreRoom,
  getSurgicalProcedures,
  createSurgicalProcedure,
  updateSurgicalProcedure,
  getSurgeries,
  createSurgery,
  updateSurgeryStatus,
  saveOperationRecord,
  getTheatreErrorMessage,
};

export default theatreService;
