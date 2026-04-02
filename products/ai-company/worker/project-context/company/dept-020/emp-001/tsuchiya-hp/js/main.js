/* ===================================
   土屋建築株式会社 - メインJS
   =================================== */

document.addEventListener('DOMContentLoaded', function() {

  // ===== Header Scroll Effect =====
  const header = document.querySelector('.site-header');
  if (header) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }

  // ===== Hamburger Menu =====
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', function() {
      hamburger.classList.toggle('active');
      mobileNav.classList.toggle('active');
      document.body.style.overflow = mobileNav.classList.contains('active') ? 'hidden' : '';
    });

    // Close mobile nav on link click
    mobileNav.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        hamburger.classList.remove('active');
        mobileNav.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  // ===== Scroll Fade-in Animation =====
  const fadeElements = document.querySelectorAll('.fade-in');

  if (fadeElements.length > 0) {
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    fadeElements.forEach(function(el) {
      observer.observe(el);
    });
  }

  // ===== Works Filter =====
  const filterTabs = document.querySelectorAll('.filter-tab');
  const workCards = document.querySelectorAll('.work-card[data-category]');

  if (filterTabs.length > 0) {
    filterTabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        // Update active tab
        filterTabs.forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');

        const category = tab.getAttribute('data-filter');

        workCards.forEach(function(card) {
          if (category === 'all' || card.getAttribute('data-category') === category) {
            card.style.display = '';
            card.style.animation = 'fadeInUp 0.5s ease forwards';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  // ===== Accordion =====
  const accordionHeaders = document.querySelectorAll('.accordion-header');

  if (accordionHeaders.length > 0) {
    accordionHeaders.forEach(function(header) {
      header.addEventListener('click', function() {
        const body = header.nextElementSibling;
        const isActive = header.classList.contains('active');

        // Close all
        accordionHeaders.forEach(function(h) {
          h.classList.remove('active');
          h.nextElementSibling.classList.remove('active');
        });

        // Toggle current
        if (!isActive) {
          header.classList.add('active');
          body.classList.add('active');
        }
      });
    });
  }

  // ===== Contact Form Validation =====
  const contactForm = document.querySelector('#contact-form');

  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();

      const name = contactForm.querySelector('[name="name"]');
      const email = contactForm.querySelector('[name="email"]');
      const message = contactForm.querySelector('[name="message"]');
      let valid = true;

      // Simple validation
      [name, email, message].forEach(function(field) {
        if (field && !field.value.trim()) {
          field.style.borderColor = '#e53e3e';
          valid = false;
        } else if (field) {
          field.style.borderColor = '';
        }
      });

      if (email && email.value && !email.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        email.style.borderColor = '#e53e3e';
        valid = false;
      }

      if (valid) {
        // In production, this would submit to a form handler
        window.location.href = 'contact-thanks.html';
      }
    });
  }

  // ===== Smooth Scroll for anchor links =====
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

});

// ===== Fade-in keyframe (for filter animation) =====
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(style);
