import api from "./api";

// Load the laboratory test catalogue.
export async function fetchLabCatalog(search = "") {
  const response = await api.get("/laboratory/catalog", {
    params: { search, active: true, page: 1, limit: 100 },
  });
  return response.data.catalog;
}

// Load laboratory orders.
export async function fetchLabOrders(search = "", status = "") {
  const response = await api.get("/laboratory/orders", {
    params: {
      search,
      status: status || undefined,
      page: 1,
      limit: 20,
    },
  });
  return response.data.orders;
}

// Create a laboratory order.
export async function createLabOrder(order) {
  const response = await api.post("/laboratory/orders", order);
  return response.data.order;
}

// Save a laboratory result.
export async function saveLabResult(orderId, itemId, result) {
  const response = await api.patch(
    `/laboratory/orders/${orderId}/items/${itemId}/result`,
    result,
  );
  return response.data.item;
}

// Update the status of an order.
export async function updateLabOrderStatus(orderId, order_status) {
  const response = await api.patch(`/laboratory/orders/${orderId}/status`, {
    order_status,
  });
  return response.data.order;
}
