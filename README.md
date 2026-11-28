# Database Management Systems: Semester 3

Lab work and capstone project for the Database Management Systems (DBMS) course.

## Repository Contents

| Folder                                 | Contents                                                                                                                     |
| :------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| [Lab 1](Lab%201)                       | Lab exercises: _Library Management System_ scenario with Book, Member, Staff, Loan, and Reservation as the core record types |
| [Lab 2](Lab%202)                       | Lab exercises: _College Record Management_ database using Student, Faculty, Course, and Exam as the core tables              |
| [Lab 3](Lab%203)                       | Lab exercises: _Transactions, PL/SQL & Database Security_                                                                    |
| [Lab 4](Lab%204)                       | Lab exercises: _NoSQL Database Design & Operations_                                                                          |
| [Capstone Project](Capstone%20Project) | **Stockly**: An e-commerce order and inventory management system (includes project report and source code)                   |

---

## Capstone Project: Stockly

**Live Demo:** [https://dbms-capstone-stockly.onrender.com/](https://dbms-capstone-stockly.onrender.com/) _(Hosted on Render's free tier—initial load may take up to a minute while the server wakes up.)_

**Stockly** is a full-stack web application for managing products, customers, orders, and live inventory for an online store. Every record lives in a relational SQL database where business rules (such as preventing negative stock) are enforced through constraints and ACID transactions.

### Key Highlights

- **Catalog & Customers:** Product catalog with categories and live stock tracking; customer records with unique emails and validated Indian mobile numbers.
- **Transactional Orders:** Multi-item order placement executed as a single database transaction (`SELECT ... FOR UPDATE`, insert, stock deduction, audit log, `COMMIT`/`ROLLBACK`), with automatic stock restoration upon cancellation.
- **Data Integrity & Auditing:** Six normalized tables (`categories`, `products`, `customers`, `orders`, `order_items`, `inventory_transactions`), two reporting views (`v_low_stock`, `v_revenue_by_category`), and soft-deletes to preserve historical order data.
- **Tech Stack:** React 19 (Vite) frontend, Node.js/Express REST API, and MySQL / TiDB Cloud database.

> **Setup & Documentation:** See the [Stockly Project README](Capstone%20Project/Stockly/README.md) for local installation steps, database seeding, and deployment instructions, or view the [Project Report](Capstone%20Project/Stockly_DBMS_Report.pdf).

---

## Author

**Chakshu Madan**
