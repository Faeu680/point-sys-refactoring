import { Request, Response } from 'express';
import { Student } from '../models/Student';
import { User } from '../models/User';
import bcrypt from 'bcryptjs';
import { cpf as CPF } from 'cpf-cnpj-validator';

export class StudentController {
  private studentModel = new Student();s
  private userModel = new User();

  public async create(req: Request, res: Response): Promise<void> {
    try {
      const validationError = this.validateCreateRequest(req.body);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const { name, email, password, cpf, rg, address, institution_id, course } = req.body;

      const [existingUser, existingStudent] = await Promise.all([
        this.userModel.findByEmail(email),
        this.studentModel.findByCpf(cpf)
      ]);

      if (existingUser) {
        res.status(400).json({ error: 'Email já cadastrado' });
        return;
      }

      if (existingStudent) {
        res.status(400).json({ error: 'CPF já cadastrado' });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await this.userModel.create({
        email,
        password: hashedPassword,
        type: 'student' as const,
        is_active: true
      });

      if (!user?.id) {
        res.status(500).json({ error: 'Erro ao criar usuário' });
        return;
      }

      const student = await this.studentModel.create({
        user_id: user.id,
        name,
        cpf,
        rg,
        address,
        institution_id,
        course
      });

      res.status(201).json({
        message: 'Aluno criado com sucesso',
        student: {
          id: student.id,
          name: student.name,
          email: user.email,
          cpf: student.cpf,
          rg: student.rg,
          address: student.address,
          institution_id: student.institution_id,
          course: student.course,
          created_at: student.created_at
        }
      });
    } catch (error) {
      console.error('Erro ao criar aluno:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  private validateCreateRequest(body: any): string | null {
    const requiredFields = ['name', 'email', 'password', 'cpf', 'institution_id'];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      return `Campos obrigatórios: ${requiredFields.join(', ')}`;
    }

    if (!CPF.isValid(body.cpf)) {
      return 'CPF inválido';
    }

    return null;
  }

  // READ - Listar todos os alunos
  public async findAll(req: Request, res: Response): Promise<void> {
    try {
      const students = await this.studentModel.findAll();
      res.json({ students });
    } catch (error) {
      console.error('Erro ao listar alunos:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // READ - Buscar aluno por ID
  public async findById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const studentId = parseInt(id);

      if (isNaN(studentId)) {
        res.status(400).json({ error: 'ID inválido' });
        return;
      }

      const student = await this.studentModel.findById(studentId);
      if (!student) {
        res.status(404).json({ error: 'Aluno não encontrado' });
        return;
      }

      res.json({ student });
    } catch (error) {
      console.error('Erro ao buscar aluno:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // READ - Buscar aluno por CPF
  public async findByCpf(req: Request, res: Response): Promise<void> {
    try {
      const { cpf } = req.params;

      if (!CPF.isValid(cpf)) {
        res.status(400).json({ error: 'CPF inválido' });
        return;
      }

      const student = await this.studentModel.findByCpf(cpf);
      if (!student) {
        res.status(404).json({ error: 'Aluno não encontrado' });
        return;
      }

      res.json({ student });
    } catch (error) {
      console.error('Erro ao buscar aluno por CPF:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // UPDATE - Atualizar aluno
  public async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const studentId = parseInt(id);
      const updateData = req.body;

      if (isNaN(studentId)) {
        res.status(400).json({ error: 'ID inválido' });
        return;
      }

      // Verificar se aluno existe
      const existingStudent = await this.studentModel.findById(studentId);
      if (!existingStudent) {
        res.status(404).json({ error: 'Aluno não encontrado' });
        return;
      }

      // Validar CPF se fornecido
      if (updateData.cpf && !CPF.isValid(updateData.cpf)) {
        res.status(400).json({ error: 'CPF inválido' });
        return;
      }

      // Verificar se CPF já existe (se diferente do atual)
      if (updateData.cpf && updateData.cpf !== existingStudent.cpf) {
        const cpfExists = await this.studentModel.findByCpf(updateData.cpf);
        if (cpfExists) {
          res.status(400).json({ error: 'CPF já cadastrado' });
          return;
        }
      }

      const success = await this.studentModel.update(studentId, updateData);
      if (!success) {
        res.status(400).json({ error: 'Erro ao atualizar aluno' });
        return;
      }

      // Buscar aluno atualizado
      const updatedStudent = await this.studentModel.findById(studentId);
      res.json({
        message: 'Aluno atualizado com sucesso',
        student: updatedStudent
      });
    } catch (error) {
      console.error('Erro ao atualizar aluno:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // DELETE - Deletar aluno
  public async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const studentId = parseInt(id);

      if (isNaN(studentId)) {
        res.status(400).json({ error: 'ID inválido' });
        return;
      }

      // Verificar se aluno existe
      const existingStudent = await this.studentModel.findById(studentId);
      if (!existingStudent) {
        res.status(404).json({ error: 'Aluno não encontrado' });
        return;
      }

      const success = await this.studentModel.delete(studentId);
      if (!success) {
        res.status(400).json({ error: 'Erro ao deletar aluno' });
        return;
      }

      res.json({ message: 'Aluno deletado com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar aluno:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // Buscar alunos por instituição
  public async findByInstitution(req: Request, res: Response): Promise<void> {
    try {
      const { institutionId } = req.params;
      const institutionIdNum = parseInt(institutionId);

      if (isNaN(institutionIdNum)) {
        res.status(400).json({ error: 'ID da instituição inválido' });
        return;
      }

      // Implementar busca por instituição (seria necessário adicionar método no modelo)
      const students = await this.studentModel.findAll();
      const filteredStudents = students.filter(student => 
        student.institution_id === institutionIdNum
      );

      res.json({ students: filteredStudents });
    } catch (error) {
      console.error('Erro ao buscar alunos por instituição:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
}
