document.getElementById("loginForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    // Odstranění existujících
    document.querySelector(".error-username").textContent = "";
    document.querySelector(".error-password").textContent = "";
    document.querySelector(".error-password-confirm").textContent = "";
    document.querySelector(".form-global-error").textContent = "";

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const passwordConfirm = document.getElementById("passwordConfirm").value;

    try {
        const response = await fetch("/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password, passwordConfirm })
        });

        const data = await response.json();

        if (!response.ok) {
            // Validace
            if (data.errors) {
                if (data.errors.username)
                    document.querySelector(".error-username").textContent = data.errors.username;

                if (data.errors.password)
                    document.querySelector(".error-password").textContent = data.errors.password;
                
                if (data.errors.passwordConfirm)
                    document.querySelector(".error-password-confirm").textContent = data.errors.passwordConfirm;
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