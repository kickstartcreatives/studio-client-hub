export const demoClients = ["client-sunrise", "client-harbor", "client-juniper"];

export const demoPages = [
  "/", "/admin", "/admin/clients", "/admin/clients/new", "/portal",
  ...demoClients.flatMap((id) => [`/admin/clients/${id}`, `/portal/${id}`]),
  "/404"
];
