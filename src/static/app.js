document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const authStatusDiv = document.getElementById("auth-status");
  const loginButton = document.getElementById("login-button");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const closeLoginButton = document.getElementById("close-login");
  const loginMessageDiv = document.getElementById("login-message");

  const ADMIN_TOKEN_KEY = "adminToken";
  let adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);

  const isAdmin = () => Boolean(adminToken);

  function updateAuthState() {
    const controls = [
      document.getElementById("email"),
      document.getElementById("activity"),
      signupForm.querySelector("button"),
    ];

    if (isAdmin()) {
      authStatusDiv.textContent =
        "Teacher mode active: register and unregister students from activities.";
      authStatusDiv.className = "message info";
      loginButton.textContent = "Logout";
      controls.forEach((control) => {
        if (control) {
          control.disabled = false;
        }
      });
    } else {
      authStatusDiv.textContent =
        "Students can view registered participants. Teachers must log in to register or unregister students.";
      authStatusDiv.className = "message info";
      loginButton.textContent = "👤 Teacher login";
      controls.forEach((control) => {
        if (control) {
          control.disabled = control.tagName === "BUTTON" ? true : true;
        }
      });
    }
  }

  function showMessage(message, type = "info") {
    messageDiv.textContent = message;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function showLoginMessage(message, type = "error") {
    loginMessageDiv.textContent = message;
    loginMessageDiv.className = `message ${type}`;
    loginMessageDiv.classList.remove("hidden");
  }

  function clearLoginMessage() {
    loginMessageDiv.textContent = "";
    loginMessageDiv.className = "message hidden";
  }

  function openLoginModal() {
    loginModal.classList.remove("hidden");
    loginModal.setAttribute("aria-hidden", "false");
    clearLoginMessage();
  }

  function closeLoginModal() {
    loginModal.classList.add("hidden");
    loginModal.setAttribute("aria-hidden", "true");
    clearLoginMessage();
  }

  function handleLogout() {
    adminToken = null;
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    updateAuthState();
    fetchActivities();
    showMessage("Logged out. Teacher mode disabled.", "info");
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML =
        '<option value="">-- Select an activity --</option>';

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map((email) => {
                    const deleteButton = isAdmin()
                      ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                      : "";
                    return `<li><span class="participant-email">${email}</span>${deleteButton}</li>`;
                  })
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    if (!isAdmin()) {
      showMessage("Teacher login required to unregister a student.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(
          email
        )}`,
        {
          method: "DELETE",
          headers: {
            "X-Admin-Token": adminToken,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isAdmin()) {
      showMessage("Teacher login required to register a student.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(
          email
        )}`,
        {
          method: "POST",
          headers: {
            "X-Admin-Token": adminToken,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  loginButton.addEventListener("click", () => {
    if (isAdmin()) {
      handleLogout();
    } else {
      openLoginModal();
    }
  });

  closeLoginButton.addEventListener("click", closeLoginModal);

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearLoginMessage();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (response.ok) {
        adminToken = result.admin_token;
        localStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
        updateAuthState();
        closeLoginModal();
        fetchActivities();
        showMessage("Teacher login successful. You may now register and unregister students.", "success");
      } else {
        showLoginMessage(result.detail || "Invalid login credentials.", "error");
      }
    } catch (error) {
      showLoginMessage("Login failed. Please try again.", "error");
      console.error("Login error:", error);
    }
  });

  updateAuthState();
  fetchActivities();
});
