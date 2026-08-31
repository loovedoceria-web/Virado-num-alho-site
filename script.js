const menuToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");
const navItems = document.querySelectorAll(".nav-links a");
const contactForm = document.getElementById("contact-form");
const formMessage = document.getElementById("form-message");

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    navLinks.classList.toggle("active");
  });
}

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    navLinks.classList.remove("active");
  });
});

if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const nome = document.getElementById("nome").value.trim();
    const telefone = document.getElementById("telefone").value.trim();
    const assunto = document.getElementById("assunto").value.trim();
    const mensagem = document.getElementById("mensagem").value.trim();

    if (!nome || !telefone || !assunto || !mensagem) {
      formMessage.textContent = "Preencha todos os campos antes de enviar.";
      return;
    }

    formMessage.textContent =
      "Mensagem enviada com sucesso. Em produção, este formulário pode ser integrado com WhatsApp, e-mail ou backend.";

    contactForm.reset();
  });
}
