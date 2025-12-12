import { Request, Response } from 'express';
import { Transaction } from '../models/Transaction';
import { User } from '../models/User';
import { Student } from '../models/Student';
import { Redemption } from '../models/Redemption';
import { Advantage } from '../models/Advantage';
import { Company } from '../models/Company';
import { sendMail } from '../utils/mailer';
import { AuthenticatedRequest } from '../middleware/auth';

export class TransactionController {
  private transactionModel = new Transaction();
  private userModel = new User();
  private studentModel = new Student();
  private redemptionModel = new Redemption();
  private advantageModel = new Advantage();
  private companyModel = new Company();

  public async getBalance(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const balance = await this.transactionModel.getBalance(userId);

      res.json({ balance });
    } catch (error) {
      console.error('Erro ao buscar saldo:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  public async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const transactions = await this.transactionModel.findByUserId(userId);

      res.json({ transactions });
    } catch (error) {
      console.error('Erro ao buscar transações:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  public async sendCoins(req: Request, res: Response): Promise<void> {
    try {
      const fromUserId = (req as any).user.id;
      const { to_email, amount, reason } = req.body;

      if (!to_email || !amount || !reason) {
        res.status(400).json({ error: 'Email do destinatário, valor e motivo são obrigatórios' });
        return;
      }

      if (amount <= 0) {
        res.status(400).json({ error: 'Valor deve ser positivo' });
        return;
      }

      const sender = await this.userModel.findById(fromUserId);
      if (!sender) {
        res.status(404).json({ error: 'Usuário remetente não encontrado' });
        return;
      }

      if (sender.type !== 'professor') {
        res.status(403).json({ error: 'Apenas professores podem enviar moedas' });
        return;
      }

      const toUser = await this.userModel.findByEmail(to_email);
      if (!toUser) {
        res.status(404).json({ error: 'Usuário destinatário não encontrado' });
        return;
      }

      if (toUser.type !== 'student') {
        res.status(400).json({ error: 'Moedas só podem ser enviadas para alunos' });
        return;
      }

      const senderBalance = await this.transactionModel.getBalance(fromUserId);
      if (senderBalance < amount) {
        res.status(400).json({ error: 'Saldo insuficiente' });
        return;
      }

      const transaction = await this.transactionModel.create({
        from_user_id: fromUserId,
        to_user_id: toUser.id,
        amount,
        reason,
        transaction_type: 'transfer'
      });

      try {
        await sendMail({
          to: toUser.email,
          subject: 'Você recebeu moedas no Sistema de Mérito Acadêmico',
          text: `Você recebeu ${amount} moedas do professor ${sender.email}.\n\nMotivo: ${reason}`
        });
      } catch (mailError) {
        console.error('Erro ao enviar email de notificação:', mailError);
      }

      res.status(201).json({
        message: 'Moedas enviadas com sucesso',
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          reason: transaction.reason,
          created_at: transaction.created_at
        }
      });
    } catch (error) {
      console.error('Erro ao enviar moedas:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  public async getStudentsWithRedemptions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.user.type !== 'professor') {
        res.status(403).json({ error: 'Apenas professores podem visualizar esta informação' });
        return;
      }

      const professorId = req.user.id;
      const allTransactions = await this.transactionModel.findByUserId(professorId);
      const sentTransactions = allTransactions.filter(
        tx => tx.from_user_id === professorId && tx.transaction_type === 'transfer'
      );

      const studentIds = [...new Set(sentTransactions
        .map(tx => tx.to_user_id)
        .filter((id): id is number => id !== undefined))];

      const studentsData = await Promise.all(
        studentIds.map(async (userId) => {
          const user = await this.userModel.findById(userId);
          if (!user || user.type !== 'student') return null;

          const student = await this.studentModel.findByUserId(userId);
          if (!student) return null;

          const studentTransactions = sentTransactions.filter(tx => tx.to_user_id === userId);
          const redemptions = await this.redemptionModel.findByStudentId(student.id);
          const enrichedRedemptions = await this.enrichRedemptions(redemptions);

          return {
            student: {
              id: student.id,
              name: student.name,
              email: user.email,
              course: student.course,
              institution_name: (student as any).institution_name
            },
            transactions: studentTransactions.map(tx => ({
              id: tx.id,
              amount: tx.amount,
              reason: tx.reason,
              created_at: tx.created_at
            })),
            redemptions: enrichedRedemptions,
            totalReceived: studentTransactions.reduce((sum, tx) => sum + tx.amount, 0)
          };
        })
      );

      const result = studentsData.filter((data): data is NonNullable<typeof data> => data !== null);
      res.json({ students: result });
    } catch (error) {
      console.error('Erro ao buscar alunos com resgates:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  private async enrichRedemptions(redemptions: any[]): Promise<any[]> {
    return Promise.all(
      redemptions.map(async (redemption) => {
        const advantage = await this.advantageModel.findById(redemption.advantage_id);
        if (!advantage) return null;

        const company = await this.companyModel.findById(advantage.company_id);
        return {
          id: redemption.id,
          redemption_code: redemption.redemption_code,
          status: redemption.status,
          created_at: redemption.created_at,
          advantage: {
            id: advantage.id,
            title: advantage.title,
            cost_coins: advantage.cost_coins
          },
          company: company ? { id: company.id, name: company.name } : null
        };
      })
    ).then(results => results.filter((r): r is NonNullable<typeof r> => r !== null));
  }
}
