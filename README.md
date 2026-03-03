# Netafim Web Application

This repository contains a full‑stack web application that serves two primary audiences for **Netafim**:

1. **Internal dashboard** – a secure portal for Netafim employees that integrates with the company’s SAP S/4 system.  The dashboard provides real‑time order management, container tracking, shipping schedules, basic BI visualizations and notifications.
2. **Client portal** – a self‑service interface for Netafim’s customers.  Clients can authenticate, view their orders and deals, chat with a smart agent, track shipments and receive notifications.  The smart agent is powered by Searates’ AI Chat Assistant API and can pull information from Netafim systems.

## Key Features

* **Integration with SAP S/4** – the backend exposes endpoints to fetch orders, deals and other business data from Netafim’s SAP environment (placeholders are provided; you should replace them with the actual SAP API calls).  A 3‑tier environment (dev/test/prod) is assumed; environment variables are used to point to the correct SAP instance.
* **Searates APIs** – container tracking and ship schedules are provided through the Searates APIs.  The API key is injected through an environment variable (`SEARATES_API_KEY`) rather than hard‑coding it.  The `services/searatesService.js` file encapsulates calls to:
  * **Container Tracking API** – retrieve the status of a given container.
  * **Ship Schedules API** – query upcoming vessel schedules.
  * **AI Chat Assistant API** – send customer questions and receive responses from the Searates assistant.
* **Authentication & Authorization** – a simple JWT based login flow is implemented as a placeholder.  Replace this with single sign‑on (SSO) via Azure AD or any OIDC provider for production use.  Authorization middleware ensures that only authenticated users can access protected routes.
* **Role‑based access** – users are assigned a `role` (`admin` or `client`) when they login.  The frontend routes are gated based on the role, and the backend can enforce role‑based authorization to protect sensitive endpoints.
* **Multi‑language support** – the frontend uses `react‑i18next` to load translation files.  English (`en`) and French (`fr`) JSON files are provided in `frontend/src/locales`.  Additional languages can be added easily.
* **Responsive design** – the client portal and dashboard are built with React and styled with basic CSS so they render correctly on desktops, tablets and mobile devices.  Feel free to replace the styling with your own design system or component library.
* **Manus hosting compatibility** – the project uses standard Node.js and React build scripts.  Manus’ cloud infrastructure can run the backend and frontend as part of a single project.  Define the required environment variables in Manus’ UI when deploying (e.g., `SEARATES_API_KEY`, `SAP_API_BASE_URL`, `JWT_SECRET`).

## Repository Structure

```
Netafim/
├── README.md               – this file
├── backend/                – Node.js Express API server
│   ├── package.json        – backend dependencies and scripts
│   ├── server.js           – Express setup and route registration
│   ├── .env.example        – example environment variables
│   ├── routes/             – Express routers
│   │   ├── auth.js
│   │   ├── orders.js
│   │   ├── searates.js
│   │   └── chat.js
│   ├── services/           – external API service wrappers
│   │   └── searatesService.js
│   └── middlewares/        – common middleware functions
│       └── authMiddleware.js
└── frontend/               – React client application
    ├── package.json        – frontend dependencies and scripts
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js        – React entry point
        ├── App.js          – route definitions and layout
        ├── i18n.js         – i18n configuration
        ├── contexts/
        │   └── AuthContext.js
        ├── components/
        │   ├── Dashboard.js
        │   ├── ClientPortal.js
        │   ├── Login.js
        │   ├── ChatAgent.js
        │   └── OrdersTable.js
        └── locales/
            ├── en.json
            └── fr.json
```

## Running the Application Locally

1. **Install dependencies**

   ```sh
   cd Netafim/backend
   npm install
   cd ../frontend
   npm install
   ```

2. **Configure environment variables** – copy `backend/.env.example` to `.env` and fill in the values for:

   * `PORT` – port number for the backend (default `4000`).
   * `JWT_SECRET` – secret key used to sign JWTs.
   * `SEARATES_API_KEY` – your Searates API key (from the Searates email thread).
   * `SAP_API_BASE_URL` – base URL of your SAP S/4 API gateway.

3. **Run the backend**

   ```sh
   cd Netafim/backend
   npm start
   ```

4. **Run the frontend** (in a separate terminal)

   ```sh
   cd Netafim/frontend
   npm start
   ```

The frontend development server will proxy API requests to the backend (`/api` prefix) by default.  When deploying to Manus, both the backend and frontend will be served together.

## Deploying to Manus

Manus allows you to import a GitHub repository and automatically deploy full‑stack applications.  Follow these steps:

1. Push this repository to GitHub (if you haven’t already).  The repository needs to be public or connected to Manus through the GitHub integration.
2. In Manus, create a new project and connect it to this GitHub repository.  Manus will detect the backend and frontend and install dependencies.
3. Go to **Settings → Environment Variables** in Manus and add the variables defined in `.env.example`.  Never commit sensitive secrets into the code base.
4. Deploy the project.  Manus will build the React frontend and run the Node.js backend automatically.

## Security & Compliance Notes

* **SSL/TLS** – ensure the Manus environment is configured to serve traffic over HTTPS.  The backend uses Express but does not enable SSL by itself because Manus manages the certificate.
* **Secure Authentication** – the provided JWT login is for demo purposes only.  Replace it with Azure AD SSO to meet the requirement for Single Sign‑On (SSO) and configure role mapping according to your IAM policies.
* **OAuth2 for integrations** – the `searatesService.js` uses an API key; for other integrations (e.g., SAP BTP, analytics tools), adopt OAuth 2.0 or mutual TLS as required by Netafim IT policies.
* **Logging & Auditing** – add proper logging (e.g., Winston) and integrate with your SIEM for audit trails.  The placeholder `console.log` calls in the server should be replaced with a structured logger.

## License

This project is provided as a sample implementation and comes without warranty.  You are free to modify and adapt it for your use within Netafim.