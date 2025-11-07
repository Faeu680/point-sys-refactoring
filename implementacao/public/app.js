// Sistema de Pontos - Frontend com Backend Integration
// Gerenciamento de Alunos e Empresas com API REST

class PointSystem {
    constructor() {
        this.baseURL = 'http://localhost:3000/api';
        this.students = [];
        this.companies = [];
        this.advantages = [];
        this.studentAdvantages = [];
        this.currentStudentId = null;
        this.currentCompanyId = null;
        this.currentAdvantageId = null;
        this.deleteCallback = null;
        this.authToken = localStorage.getItem('authToken');
        this.currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        
        // Verificar se há usuário logado
        if (this.authToken && this.currentUser) {
            this.showMainApp();
        } else {
            this.showLoginScreen();
        }
    }

    showLoginScreen() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }

    showMainApp() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        
        this.setupUserInterface();
        this.loadUserData();
    }

    setupUserInterface() {
        if (!this.currentUser) return;

        const userType = this.currentUser.type;
        const userEmail = this.currentUser.email;
        
        // Atualizar mensagem de boas-vindas
        const welcomeText = document.getElementById('userWelcome');
        if (welcomeText) {
            welcomeText.textContent = `Bem-vindo, ${userEmail} (${this.getUserTypeLabel(userType)})`;
        }

        // Esconder todas as navegações
        document.getElementById('adminNav').style.display = 'none';
        document.getElementById('studentNav').style.display = 'none';
        document.getElementById('companyNav').style.display = 'none';

        // Esconder todas as seções
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
        });

        // Mostrar navegação e seção apropriada
        if (userType === 'admin') {
            document.getElementById('adminNav').style.display = 'flex';
            document.getElementById('admin-students').style.display = 'block';
            this.setupTabNavigation();
        } else if (userType === 'student') {
            document.getElementById('studentNav').style.display = 'flex';
            document.getElementById('student-advantages').style.display = 'block';
            this.setupTabNavigation();
        } else if (userType === 'company') {
            document.getElementById('companyNav').style.display = 'flex';
            document.getElementById('company-advantages').style.display = 'block';
            this.setupTabNavigation();
        }
    }

    getUserTypeLabel(type) {
        const labels = {
            'admin': 'Administrador',
            'student': 'Aluno',
            'company': 'Empresa Parceira'
        };
        return labels[type] || type;
    }

    loadUserData() {
        if (!this.currentUser) return;

        const userType = this.currentUser.type;
        
        if (userType === 'admin') {
            this.loadStudents();
            this.loadCompanies();
        } else if (userType === 'student') {
            this.loadStudentAdvantages();
        } else if (userType === 'company') {
            this.loadAdvantages();
        }
    }

    async login(email, password) {
        try {
            const response = await this.makeRequest('/auth/login', 'POST', { email, password }, false);
            
            this.authToken = response.token;
            this.currentUser = response.user;
            
            localStorage.setItem('authToken', this.authToken);
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            
            this.showMainApp();
            this.showToast('Login realizado com sucesso!', 'success');
        } catch (error) {
            this.showToast('Erro ao fazer login. Verifique suas credenciais.', 'error');
            throw error;
        }
    }

    logout() {
        this.authToken = null;
        this.currentUser = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        this.showLoginScreen();
        this.showToast('Logout realizado com sucesso!', 'success');
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Modal close on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });

        // Close modals with escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    setupTabNavigation() {
        const tabs = document.querySelectorAll('.nav-tab');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                this.switchTab(targetTab);
            });
        });
    }

    // API Helper Methods
    async makeRequest(endpoint, method = 'GET', data = null, requiresAuth = false) {
        const url = `${this.baseURL}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (requiresAuth && this.authToken) {
            options.headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            this.showToast(error.message || 'Erro na comunicação com o servidor', 'error');
            throw error;
        }
    }

    // Student Management
    async addStudent(studentData) {
        this.showLoading('Salvando aluno...');
        
        try {
            const studentPayload = {
                name: studentData.name,
                cpf: studentData.cpf,
                rg: studentData.rg || '',
                address: studentData.address || '',
                institution_id: parseInt(studentData.institution),
                course: studentData.course || '',
                email: studentData.email,
                password: 'temp123' // Temporary password
            };
            
            const response = await this.makeRequest('/students', 'POST', studentPayload);
            console.log('Student created:', response);
            
            // Reload students to get updated list
            await this.loadStudents();
            this.hideLoading();
            this.showToast('Aluno cadastrado com sucesso!', 'success');
            this.closeStudentModal();
        } catch (error) {
            this.hideLoading();
            this.showToast('Erro ao cadastrar aluno', 'error');
        }
    }

    async updateStudent(id, studentData) {
        this.showLoading('Atualizando aluno...');
        
        try {
            const studentPayload = {
                name: studentData.name,
                cpf: studentData.cpf,
                rg: studentData.rg || '',
                address: studentData.address || '',
                institution_id: parseInt(studentData.institution),
                course: studentData.course || ''
            };
            
            const student = await this.makeRequest(`/students/${id}`, 'PUT', studentPayload);
            
            const index = this.students.findIndex(s => s.id === id);
            if (index !== -1) {
                this.students[index] = student;
            }
            
            this.loadStudents();
            this.hideLoading();
            this.showToast('Aluno atualizado com sucesso!', 'success');
            this.closeStudentModal();
        } catch (error) {
            this.hideLoading();
            this.showToast('Erro ao atualizar aluno', 'error');
        }
    }

    async deleteStudent(id) {
        this.showLoading('Removendo aluno...');
        
        try {
            await this.makeRequest(`/students/${id}`, 'DELETE');
            
            const index = this.students.findIndex(s => s.id === id);
            if (index !== -1) {
                const student = this.students[index];
                this.students.splice(index, 1);
                this.loadStudents();
                this.hideLoading();
                this.showToast(`Aluno ${student.name} removido com sucesso!`, 'success');
            }
        } catch (error) {
            this.hideLoading();
            this.showToast('Erro ao remover aluno', 'error');
        }
    }

    async loadStudents() {
        const tbody = document.getElementById('studentsTableBody');
        if (!tbody) return;

        // Show loading briefly
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <div class="loading"></div>
                    <p style="margin-top: 10px; color: #718096;">Carregando alunos...</p>
                </td>
            </tr>
        `;

        try {
            const {students} = await this.makeRequest('/students');
            this.students = students;

            setTimeout(() => {
                if (this.students.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="7" class="empty-state">
                                <i class="fas fa-user-graduate"></i>
                                <h3>Nenhum aluno cadastrado</h3>
                                <p>Clique em "Novo Aluno" para começar</p>
                            </td>
                        </tr>
                    `;
                    return;
                }

                tbody.innerHTML = this.students.map(student => `
                    <tr>
                        <td>${student.name}</td>
                        <td>${student.cpf}</td>
                        <td>${student.email || '-'}</td>
                        <td>${this.getInstitutionName(student.institution_id)}</td>
                        <td>${student.course || '-'}</td>
                        <td><span class="status-badge status-active">0 pts</span></td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn btn-warning" onclick="editStudent(${student.id})" title="Editar">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn btn-danger" onclick="confirmDeleteStudent(${student.id})" title="Excluir">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }, 500);
        } catch (error) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Erro ao carregar alunos</h3>
                        <p>Verifique a conexão com o servidor</p>
                    </td>
                </tr>
            `;
        }
    }

    // Company Management
    async addCompany(companyData) {
        this.showLoading('Salvando empresa...');
        
        try {
            const companyPayload = {
                name: companyData.name,
                cnpj: companyData.cnpj,
                description: companyData.description || '',
                address: companyData.address || '',
                phone: companyData.phone || '',
                email: companyData.email,
                website: companyData.website || '',
                is_active: companyData.is_active,
                password: 'temp123' // Temporary password
            };
            
            const response = await this.makeRequest('/companies', 'POST', companyPayload);
            console.log('Company created:', response);
            
            // Reload companies to get updated list
            await this.loadCompanies();
            this.hideLoading();
            this.showToast('Empresa cadastrada com sucesso!', 'success');
            this.closeCompanyModal();
        } catch (error) {
            this.hideLoading();
            this.showToast('Erro ao cadastrar empresa', 'error');
        }
    }

    async updateCompany(id, companyData) {
        this.showLoading('Atualizando empresa...');
        
        try {
            const companyPayload = {
                name: companyData.name,
                cnpj: companyData.cnpj,
                description: companyData.description || '',
                address: companyData.address || '',
                phone: companyData.phone || '',
                email: companyData.email,
                website: companyData.website || '',
                is_active: companyData.is_active
            };
            
            const company = await this.makeRequest(`/companies/${id}`, 'PUT', companyPayload);
            
            const index = this.companies.findIndex(c => c.id === id);
            if (index !== -1) {
                this.companies[index] = company;
            }
            
            this.loadCompanies();
            this.hideLoading();
            this.showToast('Empresa atualizada com sucesso!', 'success');
            this.closeCompanyModal();
        } catch (error) {
            this.hideLoading();
            this.showToast('Erro ao atualizar empresa', 'error');
        }
    }

    async deleteCompany(id) {
        this.showLoading('Removendo empresa...');
        
        try {
            await this.makeRequest(`/companies/${id}`, 'DELETE');
            
            const index = this.companies.findIndex(c => c.id === id);
            if (index !== -1) {
                const company = this.companies[index];
                this.companies.splice(index, 1);
                this.loadCompanies();
                this.hideLoading();
                this.showToast(`Empresa ${company.name} removida com sucesso!`, 'success');
            }
        } catch (error) {
            this.hideLoading();
            this.showToast('Erro ao remover empresa', 'error');
        }
    }

    async loadCompanies() {
        const tbody = document.getElementById('companiesTableBody');
        if (!tbody) return;

        // Show loading briefly
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <div class="loading"></div>
                    <p style="margin-top: 10px; color: #718096;">Carregando empresas...</p>
                </td>
            </tr>
        `;

        try {
            const {companies} = await this.makeRequest('/companies');
            this.companies = companies;

            setTimeout(() => {
                if (this.companies.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="6" class="empty-state">
                                <i class="fas fa-building"></i>
                                <h3>Nenhuma empresa cadastrada</h3>
                                <p>Clique em "Nova Empresa" para começar</p>
                            </td>
                        </tr>
                    `;
                    return;
                }

                tbody.innerHTML = this.companies.map(company => `
                    <tr>
                        <td>${company.name}</td>
                        <td>${company.cnpj}</td>
                        <td>${company.email || '-'}</td>
                        <td>${company.phone || '-'}</td>
                        <td>
                            <span class="status-badge ${company.is_active ? 'status-active' : 'status-inactive'}">
                                ${company.is_active ? 'Ativa' : 'Inativa'}
                            </span>
                        </td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn btn-warning" onclick="editCompany(${company.id})" title="Editar">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn ${company.is_active ? 'btn-secondary' : 'btn-success'}" 
                                        onclick="toggleCompanyStatus(${company.id})" 
                                        title="${company.is_active ? 'Desativar' : 'Ativar'}">
                                    <i class="fas fa-${company.is_active ? 'pause' : 'play'}"></i>
                                </button>
                                <button class="action-btn btn-danger" onclick="confirmDeleteCompany(${company.id})" title="Excluir">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }, 500);
        } catch (error) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Erro ao carregar empresas</h3>
                        <p>Verifique a conexão com o servidor</p>
                    </td>
                </tr>
            `;
        }
    }

    async toggleCompanyStatus(id) {
        this.showLoading('Alterando status da empresa...');
        
        try {
            await this.makeRequest(`/companies/${id}/toggle`, 'PUT');
            
            // Reload companies to get updated data
            await this.loadCompanies();
            this.hideLoading();
            this.showToast('Status da empresa alterado com sucesso!', 'success');
        } catch (error) {
            this.hideLoading();
            this.showToast('Erro ao alterar status da empresa', 'error');
        }
    }

    // Advantage Management (Company)
    async addAdvantage(advantageData) {
        this.showLoading('Salvando vantagem...');
        
        try {
            const advantagePayload = {
                title: advantageData.title,
                description: advantageData.description,
                image_url: advantageData.image_url || null,
                cost_coins: parseInt(advantageData.cost_coins),
                is_active: advantageData.is_active
            };
            
            // Tentar usar rota autenticada primeiro
            let response;
            try {
                response = await this.makeRequest('/advantages', 'POST', advantagePayload, true);
            } catch (error) {
                // Se falhar, usar rota demo
                response = await this.makeRequest('/advantages/demo', 'POST', advantagePayload, false);
            }
            console.log('Advantage created:', response);
            
            await this.loadAdvantages();
            this.hideLoading();
            this.showToast('Vantagem cadastrada com sucesso!', 'success');
            this.closeAdvantageModal();
        } catch (error) {
            this.hideLoading();
            // Error message already shown by makeRequest
        }
    }

    async updateAdvantage(id, advantageData) {
        this.showLoading('Atualizando vantagem...');
        
        try {
            const advantagePayload = {
                title: advantageData.title,
                description: advantageData.description,
                image_url: advantageData.image_url || null,
                cost_coins: parseInt(advantageData.cost_coins),
                is_active: advantageData.is_active
            };
            
            // Tentar usar rota autenticada primeiro
            try {
                await this.makeRequest(`/advantages/${id}`, 'PUT', advantagePayload, true);
            } catch (error) {
                // Se falhar, usar rota demo
                await this.makeRequest(`/advantages/demo/${id}`, 'PUT', advantagePayload, false);
            }
            
            await this.loadAdvantages();
            this.hideLoading();
            this.showToast('Vantagem atualizada com sucesso!', 'success');
            this.closeAdvantageModal();
        } catch (error) {
            this.hideLoading();
            // Error message already shown by makeRequest
        }
    }

    async deleteAdvantage(id) {
        this.showLoading('Removendo vantagem...');
        
        try {
            // Tentar usar rota autenticada primeiro
            try {
                await this.makeRequest(`/advantages/${id}`, 'DELETE', null, true);
            } catch (error) {
                // Se falhar, usar rota demo
                await this.makeRequest(`/advantages/demo/${id}`, 'DELETE', null, false);
            }
            
            const index = this.advantages.findIndex(a => a.id === id);
            if (index !== -1) {
                const advantage = this.advantages[index];
                this.advantages.splice(index, 1);
                await this.loadAdvantages();
                this.hideLoading();
                this.showToast(`Vantagem "${advantage.title}" removida com sucesso!`, 'success');
            }
        } catch (error) {
            this.hideLoading();
            // Error message already shown by makeRequest
        }
    }

    async loadAdvantages() {
        const tbody = document.getElementById('advantagesTableBody');
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px;">
                    <div class="loading"></div>
                    <p style="margin-top: 10px; color: #718096;">Carregando vantagens...</p>
                </td>
            </tr>
        `;

        try {
            // Tentar usar rota autenticada primeiro, se falhar usar rota demo
            let advantages = [];
            try {
                const response = await this.makeRequest('/advantages/company/my-advantages', 'GET', null, true);
                advantages = response.advantages || [];
            } catch (error) {
                // Se falhar, usar rota pública (para demonstração)
                const response = await this.makeRequest('/advantages');
                advantages = response.advantages || [];
            }
            this.advantages = advantages;

            setTimeout(() => {
                if (this.advantages.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="5" class="empty-state">
                                <i class="fas fa-gift"></i>
                                <h3>Nenhuma vantagem cadastrada</h3>
                                <p>Clique em "Nova Vantagem" para começar</p>
                            </td>
                        </tr>
                    `;
                    return;
                }

                tbody.innerHTML = this.advantages.map(advantage => `
                    <tr>
                        <td>${advantage.title}</td>
                        <td>${advantage.description.length > 50 ? advantage.description.substring(0, 50) + '...' : advantage.description}</td>
                        <td><span class="status-badge status-active">${advantage.cost_coins} moedas</span></td>
                        <td>
                            <span class="status-badge ${advantage.is_active ? 'status-active' : 'status-inactive'}">
                                ${advantage.is_active ? 'Ativa' : 'Inativa'}
                            </span>
                        </td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn btn-warning" onclick="editAdvantage(${advantage.id})" title="Editar">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn ${advantage.is_active ? 'btn-secondary' : 'btn-success'}" 
                                        onclick="toggleAdvantageStatus(${advantage.id})" 
                                        title="${advantage.is_active ? 'Desativar' : 'Ativar'}">
                                    <i class="fas fa-${advantage.is_active ? 'pause' : 'play'}"></i>
                                </button>
                                <button class="action-btn btn-danger" onclick="confirmDeleteAdvantage(${advantage.id})" title="Excluir">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }, 500);
        } catch (error) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Erro ao carregar vantagens</h3>
                        <p>Verifique a conexão com o servidor</p>
                    </td>
                </tr>
            `;
        }
    }

    async toggleAdvantageStatus(id) {
        this.showLoading('Alterando status da vantagem...');
        
        try {
            // Tentar usar rota autenticada primeiro
            try {
                await this.makeRequest(`/advantages/${id}/toggle`, 'PUT', null, true);
            } catch (error) {
                // Se falhar, usar rota demo
                await this.makeRequest(`/advantages/demo/${id}/toggle`, 'PUT', null, false);
            }
            
            await this.loadAdvantages();
            this.hideLoading();
            this.showToast('Status da vantagem alterado com sucesso!', 'success');
        } catch (error) {
            this.hideLoading();
            // Error message already shown by makeRequest
        }
    }

    // Student Advantages Management
    async loadStudentAdvantages() {
        const grid = document.getElementById('studentAdvantagesGrid');
        if (!grid) return;

        grid.innerHTML = `
            <div style="text-align: center; padding: 40px; width: 100%;">
                <div class="loading"></div>
                <p style="margin-top: 10px; color: #718096;">Carregando vantagens...</p>
            </div>
        `;

        try {
            const {advantages} = await this.makeRequest('/advantages');
            this.studentAdvantages = advantages;

            setTimeout(() => {
                if (this.studentAdvantages.length === 0) {
                    grid.innerHTML = `
                        <div class="empty-state" style="width: 100%;">
                            <i class="fas fa-store"></i>
                            <h3>Nenhuma vantagem disponível</h3>
                            <p>Não há vantagens cadastradas no momento</p>
                        </div>
                    `;
                    return;
                }

                grid.innerHTML = this.studentAdvantages.map(advantage => `
                    <div class="advantage-card">
                        <div class="advantage-card-image">
                            ${advantage.image_url 
                                ? `<img src="${advantage.image_url}" alt="${advantage.title}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-gift\\'></i>'">`
                                : `<i class="fas fa-gift"></i>`
                            }
                        </div>
                        <div class="advantage-card-body">
                            <h3 class="advantage-card-title">${advantage.title}</h3>
                            <p class="advantage-card-description">${advantage.description}</p>
                            <div class="advantage-card-footer">
                                <div class="advantage-card-cost">
                                    <i class="fas fa-coins"></i>
                                    ${advantage.cost_coins}
                                </div>
                                <div class="advantage-card-company">
                                    ${advantage.company_name || 'Empresa Parceira'}
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('');
            }, 500);
        } catch (error) {
            grid.innerHTML = `
                <div class="empty-state" style="width: 100%;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Erro ao carregar vantagens</h3>
                    <p>Verifique a conexão com o servidor</p>
                </div>
            `;
        }
    }

    // Utility Methods
    getInstitutionName(id) {
        const institutions = {
            1: 'Universidade Federal de Tecnologia',
            2: 'Instituto Tecnológico Nacional',
            3: 'Faculdade de Ciências Aplicadas'
        };
        return institutions[id] || 'Instituição não encontrada';
    }

    formatCpf(cpf) {
        return cpf.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    formatCnpj(cnpj) {
        return cnpj.replace(/\D/g, '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }

    formatPhone(phone) {
        return phone.replace(/\D/g, '').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }

    // Modal Management
    openStudentModal(studentId = null) {
        const modal = document.getElementById('studentModal');
        const title = document.getElementById('studentModalTitle');
        const form = document.getElementById('studentForm');
        
        this.currentStudentId = studentId;
        
        if (studentId) {
            title.textContent = 'Editar Aluno';
            const student = this.students.find(s => s.id === studentId);
            if (student) {
                document.getElementById('studentName').value = student.name;
                document.getElementById('studentCpf').value = student.cpf;
                document.getElementById('studentRg').value = student.rg || '';
                document.getElementById('studentEmail').value = student.email || '';
                document.getElementById('studentInstitution').value = student.institution_id;
                document.getElementById('studentCourse').value = student.course || '';
                document.getElementById('studentAddress').value = student.address || '';
            }
        } else {
            title.textContent = 'Novo Aluno';
            form.reset();
        }
        
        modal.style.display = 'block';
    }

    closeStudentModal() {
        document.getElementById('studentModal').style.display = 'none';
        this.currentStudentId = null;
    }

    openCompanyModal(companyId = null) {
        const modal = document.getElementById('companyModal');
        const title = document.getElementById('companyModalTitle');
        const form = document.getElementById('companyForm');
        
        this.currentCompanyId = companyId;
        
        if (companyId) {
            title.textContent = 'Editar Empresa';
            const company = this.companies.find(c => c.id === companyId);
            if (company) {
                document.getElementById('companyName').value = company.name;
                document.getElementById('companyCnpj').value = company.cnpj;
                document.getElementById('companyEmail').value = company.email || '';
                document.getElementById('companyPhone').value = company.phone || '';
                document.getElementById('companyWebsite').value = company.website || '';
                document.getElementById('companyDescription').value = company.description || '';
                document.getElementById('companyAddress').value = company.address || '';
                document.getElementById('companyActive').checked = company.is_active;
            }
        } else {
            title.textContent = 'Nova Empresa';
            form.reset();
        }
        
        modal.style.display = 'block';
    }

    closeCompanyModal() {
        document.getElementById('companyModal').style.display = 'none';
        this.currentCompanyId = null;
    }

    openAdvantageModal(advantageId = null) {
        const modal = document.getElementById('advantageModal');
        const title = document.getElementById('advantageModalTitle');
        const form = document.getElementById('advantageForm');
        
        this.currentAdvantageId = advantageId;
        
        if (advantageId) {
            title.textContent = 'Editar Vantagem';
            const advantage = this.advantages.find(a => a.id === advantageId);
            if (advantage) {
                document.getElementById('advantageTitle').value = advantage.title;
                document.getElementById('advantageDescription').value = advantage.description;
                document.getElementById('advantageImageUrl').value = advantage.image_url || '';
                document.getElementById('advantageCostCoins').value = advantage.cost_coins;
                document.getElementById('advantageActive').checked = advantage.is_active;
            }
        } else {
            title.textContent = 'Nova Vantagem';
            form.reset();
        }
        
        modal.style.display = 'block';
    }

    closeAdvantageModal() {
        document.getElementById('advantageModal').style.display = 'none';
        this.currentAdvantageId = null;
    }

    closeAllModals() {
        this.closeStudentModal();
        this.closeCompanyModal();
        this.closeAdvantageModal();
        this.closeConfirmModal();
    }

    // Confirmation Modal
    showConfirmModal(message, callback) {
        document.getElementById('confirmMessage').textContent = message;
        this.deleteCallback = callback;
        document.getElementById('confirmModal').style.display = 'block';
    }

    closeConfirmModal() {
        document.getElementById('confirmModal').style.display = 'none';
        this.deleteCallback = null;
    }

    confirmDelete() {
        if (this.deleteCallback) {
            this.deleteCallback();
        }
        this.closeConfirmModal();
    }

    // Search and Filter
    filterStudents() {
        const searchTerm = document.getElementById('studentSearch').value.toLowerCase();
        const rows = document.querySelectorAll('#studentsTableBody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    filterCompanies() {
        const searchTerm = document.getElementById('companySearch').value.toLowerCase();
        const rows = document.querySelectorAll('#companiesTableBody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    filterAdvantages() {
        const searchTerm = document.getElementById('advantageSearch').value.toLowerCase();
        const rows = document.querySelectorAll('#advantagesTableBody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    filterStudentAdvantages() {
        const searchTerm = document.getElementById('studentAdvantageSearch').value.toLowerCase();
        const cards = document.querySelectorAll('.advantage-card');
        
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            card.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    // Loading Management
    showLoading(message = 'Carregando...') {
        // Create loading overlay if it doesn't exist
        let loadingOverlay = document.getElementById('loadingOverlay');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'loadingOverlay';
            loadingOverlay.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <p class="loading-message">${message}</p>
                </div>
            `;
            document.body.appendChild(loadingOverlay);
        } else {
            loadingOverlay.querySelector('.loading-message').textContent = message;
            loadingOverlay.style.display = 'flex';
        }
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    // Toast Notifications
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Tab Management
    switchTab(tabName) {
        // Remove active class from all tabs
        document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
        
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active');
        });
        
        // Show selected tab and section
        const selectedTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }
        
        const targetSection = document.getElementById(tabName);
        if (targetSection) {
            targetSection.style.display = 'block';
            targetSection.classList.add('active');
        }
        
        // Load data if needed
        if (tabName === 'company-advantages') {
            this.loadAdvantages();
        } else if (tabName === 'student-advantages') {
            this.loadStudentAdvantages();
        } else if (tabName === 'admin-students') {
            this.loadStudents();
        } else if (tabName === 'admin-companies') {
            this.loadCompanies();
        }
    }
}

// Initialize the application
const app = new PointSystem();

// Global functions for HTML onclick events
function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    app.login(email, password).catch(() => {
        // Error already handled in login method
    });
}

function handleLogout() {
    app.logout();
}

function openStudentModal() {
    app.openStudentModal();
}

function closeStudentModal() {
    app.closeStudentModal();
}

function openCompanyModal() {
    app.openCompanyModal();
}

function closeCompanyModal() {
    app.closeCompanyModal();
}

function saveStudent(event) {
    event.preventDefault();
    
    const formData = {
        name: document.getElementById('studentName').value,
        cpf: document.getElementById('studentCpf').value,
        rg: document.getElementById('studentRg').value,
        email: document.getElementById('studentEmail').value,
        institution: document.getElementById('studentInstitution').value,
        course: document.getElementById('studentCourse').value,
        address: document.getElementById('studentAddress').value
    };

    if (app.currentStudentId) {
        app.updateStudent(app.currentStudentId, formData);
    } else {
        app.addStudent(formData);
    }
}

function saveCompany(event) {
    event.preventDefault();
    
    const formData = {
        name: document.getElementById('companyName').value,
        cnpj: document.getElementById('companyCnpj').value,
        email: document.getElementById('companyEmail').value,
        phone: document.getElementById('companyPhone').value,
        website: document.getElementById('companyWebsite').value,
        description: document.getElementById('companyDescription').value,
        address: document.getElementById('companyAddress').value,
        is_active: document.getElementById('companyActive').checked
    };

    if (app.currentCompanyId) {
        app.updateCompany(app.currentCompanyId, formData);
    } else {
        app.addCompany(formData);
    }
}

function editStudent(id) {
    app.openStudentModal(id);
}

function editCompany(id) {
    app.openCompanyModal(id);
}

function confirmDeleteStudent(id) {
    const student = app.students.find(s => s.id === id);
    app.showConfirmModal(`Tem certeza que deseja excluir o aluno "${student.name}"?`, () => {
        app.deleteStudent(id);
    });
}

function confirmDeleteCompany(id) {
    const company = app.companies.find(c => c.id === id);
    app.showConfirmModal(`Tem certeza que deseja excluir a empresa "${company.name}"?`, () => {
        app.deleteCompany(id);
    });
}

function toggleCompanyStatus(id) {
    app.toggleCompanyStatus(id);
}

function closeConfirmModal() {
    app.closeConfirmModal();
}

function confirmDelete() {
    app.confirmDelete();
}

function filterStudents() {
    app.filterStudents();
}

function filterCompanies() {
    app.filterCompanies();
}

// Input formatting functions
function formatCpf(input) {
    input.value = app.formatCpf(input.value);
}

function formatCnpj(input) {
    input.value = app.formatCnpj(input.value);
}

function formatPhone(input) {
    input.value = app.formatPhone(input.value);
}

// Advantage functions
function openAdvantageModal() {
    app.openAdvantageModal();
}

function closeAdvantageModal() {
    app.closeAdvantageModal();
}

function saveAdvantage(event) {
    event.preventDefault();
    
    const formData = {
        title: document.getElementById('advantageTitle').value,
        description: document.getElementById('advantageDescription').value,
        image_url: document.getElementById('advantageImageUrl').value,
        cost_coins: document.getElementById('advantageCostCoins').value,
        is_active: document.getElementById('advantageActive').checked
    };

    if (app.currentAdvantageId) {
        app.updateAdvantage(app.currentAdvantageId, formData);
    } else {
        app.addAdvantage(formData);
    }
}

function editAdvantage(id) {
    app.openAdvantageModal(id);
}

function confirmDeleteAdvantage(id) {
    const advantage = app.advantages.find(a => a.id === id);
    app.showConfirmModal(`Tem certeza que deseja excluir a vantagem "${advantage.title}"?`, () => {
        app.deleteAdvantage(id);
    });
}

function toggleAdvantageStatus(id) {
    app.toggleAdvantageStatus(id);
}

function filterAdvantages() {
    app.filterAdvantages();
}

function filterStudentAdvantages() {
    app.filterStudentAdvantages();
}