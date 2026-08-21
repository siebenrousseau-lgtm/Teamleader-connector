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
// Ondersteunt optioneel: zoekterm, status (open/won/lost), een specifieke fase
// (phase_id, op te zoeken via listDealPhases), en datumfilters:
//   - createdBefore          -> enkel deals aangemaakt vóór deze datum
//   - updatedSince           -> enkel deals gewijzigd sinds deze datum
//   - closingDateFrom/Until  -> op verwachte afsluitdatum
async function searchDeals(
  {
    query,
    status,
    phaseId,
    createdBefore,
    updatedSince,
    closingDateFrom,
    closingDateUntil,
  } = {},
  pageSize = 50
) {
  const filter = {};
  if (query) filter.term = query;
  if (status) filter.status = Array.isArray(status) ? status : [status];
  if (phaseId) filter.phase_id = phaseId;
  if (createdBefore) filter.created_before = createdBefore;
  if (updatedSince) filter.updated_since = updatedSince;
  if (closingDateFrom) filter.estimated_closing_date_from = closingDateFrom;
  if (closingDateUntil) filter.estimated_closing_date_until = closingDateUntil;

  return callApi("deals.list", {
    filter: Object.keys(filter).length ? filter : undefined,
    page: { size: pageSize, number: 1 },
  });
}

async function getDeal(id) {
  return callApi("deals.info", { id });
}

// Geeft de lijst van fases (pipeline-stappen) terug, met hun id en naam.
// Handig om de juiste phase_id op te zoeken voor searchDeals hierboven.
async function listDealPhases(pipelineId) {
  return callApi(
    "dealPhases.list",
    pipelineId ? { filter: { pipeline_id: pipelineId } } : {}
  );
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
// Ondersteunt optioneel: een zoekterm, een periode (factuurdatum) en een status
// ("draft" = concept, "outstanding" = nog niet volledig betaald, "matched" = betaald/vereffend).
async function searchInvoices(
  { query, dateFrom, dateTo, status } = {},
  pageSize = 50
) {
  const filter = {};
  if (query) filter.term = query;
  if (dateFrom) filter.invoice_date_after = dateFrom;
  if (dateTo) filter.invoice_date_before = dateTo;
  if (status) filter.status = Array.isArray(status) ? status : [status];

  return callApi("invoices.list", {
    filter: Object.keys(filter).length ? filter : undefined,
    page: { size: pageSize, number: 1 },
  });
}

async function getInvoice(id) {
  return callApi("invoices.info", { id });
}

module.exports = {
  searchDeals,
  getDeal,
  listDealPhases,
  searchContacts,
  searchCompanies,
  searchInvoices,
  getInvoice,
};
