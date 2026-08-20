// teamleaderClient.js
//
// Dunne wrapper rond de Teamleader Focus API (https://developer.teamleader.eu).
// Elke functie doet één "action" (Teamleader werkt met RPC-achtige POST-calls,
// niet met klassieke REST), en zorgt telkens voor een geldige access token.

const axios = require("axios");
const { getValidAccessToken } = require("./tokenStore");

const API_BASE = "https://api.focus.teamleader.eu";

async function callApi(action, body = {}) {
  const accessToken = await getValidAccessToken();
  const res = await axios.post(`${API_BASE}/${action}`, body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  return res.data;
}

// ---- Deals (offertes / projecten) ----
async function searchDeals(query, pageSize = 20) {
  return callApi("deals.list", {
    filter: query ? { term: query } : undefined,
    page: { size: pageSize, number: 1 },
  });
}

async function getDeal(id) {
  return callApi("deals.info", { id });
}

// ---- Contacten ----
async function searchContacts(query, pageSize = 20) {
  return callApi("contacts.list", {
    filter: query ? { term: query } : undefined,
    page: { size: pageSize, number: 1 },
  });
}

// ---- Bedrijven ----
async function searchCompanies(query, pageSize = 20) {
  return callApi("companies.list", {
    filter: query ? { term: query } : undefined,
    page: { size: pageSize, number: 1 },
  });
}

// ---- Facturen ----
async function searchInvoices(query, pageSize = 20) {
  return callApi("invoices.list", {
    filter: query ? { term: query } : undefined,
    page: { size: pageSize, number: 1 },
  });
}

async function getInvoice(id) {
  return callApi("invoices.info", { id });
}

module.exports = {
  searchDeals,
  getDeal,
  searchContacts,
  searchCompanies,
  searchInvoices,
  getInvoice,
};
