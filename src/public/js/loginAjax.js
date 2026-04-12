document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");

    if (loginForm) {
        loginForm.addEventListener("submit", async function(e) {
            e.preventDefault();

            // Odstranění existujících
            document.querySelector(".error-username").textContent = "";
            document.querySelector(".error-password").textContent = "";
            document.querySelector(".form-global-error").textContent = "";

            const username = document.getElementById("username").value;
            const password = document.getElementById("password").value;

            try {
                const response = await fetch("/auth/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    // Validace
                    if (data.errors) {
                        if (data.errors.username)
                            document.querySelector(".error-username").textContent = data.errors.username;

                        if (data.errors.password)
                            document.querySelector(".error-password").textContent = data.errors.password;
                    }

                    if (data.message) {
                        document.querySelector(".form-global-error").textContent = data.message;
                    }

                    return;
                }

                // Success
                window.location.href = data.redirect || "/";

            } catch (err) {
                document.querySelector(".form-global-error").textContent = "Server error. Zkuste to znovu.";
            }
        });

        // Přidání reakce na Enter ve všech inputech formuláře
        loginForm.querySelectorAll("input").forEach(input => {
            input.addEventListener("keypress", function(e) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    loginForm.requestSubmit();
                }
            });
        });
    }
});
