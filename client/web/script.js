// A reference to Stripe.js
let stripe;
let cart;

// Disable the button until we have Stripe set up on the page
document.querySelector("button").disabled = true;

fetch("/config")
  .then(function(result) {
    return result.json();
  })
  .then(function(data) {
    stripe = Stripe(data.publicKey, { betas: ["au_bank_account_beta_2"] });
    cart = data.cart;
    // Show formatted price information.
    const price = (cart.amount / 100).toFixed(2);
    const numberFormat = new Intl.NumberFormat(["en-AU"], {
      style: "currency",
      currency: cart.currency,
      currencyDisplay: "symbol"
    });
    document.getElementById("order-amount").innerText = numberFormat.format(
      price
    );
    const { auBankAccount } = setupElements();

    // Handle form submission.
    const form = document.getElementById("payment-form");
    form.addEventListener("submit", function(event) {
      event.preventDefault();
      if (!document.getElementsByTagName("form")[0].reportValidity()) {
        // Form not valid, abort
        return;
      }
      changeLoadingState(true);
      // Create PaymentIntent
      createPaymentIntent().then(intent => {
        pay({ auBankAccount, clientSecret: intent.clientSecret });
      });
    });
  });

const createPaymentIntent = async function() {
  return await fetch(`/create-payment-intent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      cart,
      name: document.querySelector('input[name="name"]').value,
      email: document.querySelector('input[name="email"]').value
    })
  }).then(res => res.json());
};

// Set up Stripe.js and Elements to use in checkout form
const setupElements = function() {
  const elements = stripe.elements();
  // Custom styling can be passed to options when creating an Element
  const style = {
    base: {
      // Add your base input styles here. For example:
      fontSize: "16px",
      color: "#32325d"
    }
  };

  const options = {
    style: style,
    disabled: false,
    hideIcon: false,
    iconStyle: "default" // or "solid"
  };

  // Create an instance of the auBankAccount Element.
  const auBankAccount = elements.create("auBankAccount", options);

  // Add an instance of the auBankAccount Element into
  // the `au-bank-account-element` <div>.
  auBankAccount.mount("#au-bank-account-element");

  auBankAccount.on("change", function(event) {
    document.getElementById("bank-name").textContent = event.bankName
      ? `(${event.bankName})`
      : "";
    // Handle real-time validation errors from the Element.
    if (event.error) {
      showError(event.error.message);
    } else if (event.complete) {
      // Enable button.
      document.querySelector("button").disabled = false;
    } else {
      document.querySelector("button").disabled = true;
    }
  });

  return {
    auBankAccount: auBankAccount
  };
};

/*
 * Calls stripe.confirmAuBecsDebitPayment to generate the mandate and initaite the debit.
 */
const pay = function({ auBankAccount, clientSecret }) {
  stripe
    .confirmAuBecsDebitPayment(clientSecret, {
      payment_method: {
        au_becs_debit: auBankAccount,
        billing_details: {
          name: document.querySelector('input[name="name"]').value,
          email: document.querySelector('input[name="email"]').value
        }
      }
    })
    .then(function(result) {
      const { error, paymentIntent } = result;
      if (error) {
        // Show error to your customer
        showError(error.message);
      } else if (paymentIntent) {
        orderComplete(paymentIntent);
      } else {
        showError("An unexpected error occured.");
      }
    });
};

/* ------- Post-payment helpers ------- */

/* Shows a success / error message when the payment is complete */
const orderComplete = function(object) {
  const stringifiedObject = JSON.stringify(object, null, 2);

  document.querySelector(".sr-payment-form").classList.add("hidden");
  document.querySelector("pre").textContent = stringifiedObject;

  document.querySelector(".sr-result").classList.remove("hidden");
  setTimeout(function() {
    document.querySelector(".sr-result").classList.add("expand");
  }, 200);

  changeLoadingState(false);
};

const showError = function(errorMsgText) {
  changeLoadingState(false);
  const errorMsg = document.querySelector("#error-message");
  errorMsg.textContent = errorMsgText;
  setTimeout(function() {
    errorMsg.textContent = "";
  }, 4000);
};

// Show a spinner on payment submission
const changeLoadingState = function(isLoading) {
  if (isLoading) {
    document.querySelector("button").disabled = true;
    document.querySelector("#spinner").classList.remove("hidden");
    document.querySelector("#button-text").classList.add("hidden");
  } else {
    document.querySelector("button").disabled = true;
    document.querySelector("#spinner").classList.add("hidden");
    document.querySelector("#button-text").classList.remove("hidden");
  }
};
