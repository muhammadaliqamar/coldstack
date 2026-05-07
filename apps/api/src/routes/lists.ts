import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@coldstack/db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import multer from 'multer';
import { parse as csvParse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import path from 'path';

const router = Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.csv', '.xlsx', '.xls'].includes(ext)) cb(null, true);
    else cb(new Error('Only CSV and XLSX files are allowed'));
  },
});

const updateContactSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  customFields: z.record(z.any()).optional(),
});

// POST /upload
router.post('/upload', upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    let records: any[] = [];
    if (ext === '.csv') {
      records = csvParse(req.file.buffer.toString(), { columns: true, skip_empty_lines: true, trim: true });
    } else {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      records = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    }
    if (!records.length) return res.status(400).json({ error: 'File contains no data' });

    const listName = req.body.name || req.file.originalname.replace(/\.[^/.]+$/, '');
    const emailList = await prisma.emailList.create({
      data: { userId: req.userId!, name: listName, fileName: req.file.originalname, totalContacts: records.length },
    });

    const getField = (record: any, names: string[]) => {
      for (const n of names) if (record[n] !== undefined) return record[n]?.toString() || null;
      return null;
    };

    const contacts = records.map((r: any) => ({
      listId: emailList.id,
      email: getField(r, ['email','Email','EMAIL','e-mail']) || '',
      firstName: getField(r, ['firstName','first_name','First Name','first']),
      lastName: getField(r, ['lastName','last_name','Last Name','last']),
      company: getField(r, ['company','Company','organization']),
      title: getField(r, ['title','Title','job_title','position']),
      phone: getField(r, ['phone','Phone','mobile']),
    })).filter((c: any) => c.email);

    if (contacts.length > 0) {
      await prisma.contact.createMany({ data: contacts, skipDuplicates: true });
      const count = await prisma.contact.count({ where: { listId: emailList.id } });
      await prisma.emailList.update({ where: { id: emailList.id }, data: { totalContacts: count } });
    }

    res.status(201).json({ list: emailList, imported: contacts.length, preview: records.slice(0, 10), columns: records.length > 0 ? Object.keys(records[0]) : [] });
  } catch (error) { next(error); }
});

// GET /
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const lists = await prisma.emailList.findMany({
      where: { userId: req.userId! },
      include: { _count: { select: { contacts: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(lists);
  } catch (error) { next(error); }
});

// GET /:id/contacts
router.get('/:id/contacts', async (req: AuthRequest, res, next) => {
  try {
    const list = await prisma.emailList.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!list) return res.status(404).json({ error: 'List not found' });
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const search = req.query.search as string;
    const where: any = { listId: list.id };
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.contact.count({ where }),
    ]);
    res.json({ contacts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
});

// DELETE /:id
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const list = await prisma.emailList.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!list) return res.status(404).json({ error: 'List not found' });
    await prisma.emailList.delete({ where: { id: list.id } });
    res.json({ message: 'List deleted' });
  } catch (error) { next(error); }
});

// PUT /:id/contacts/:contactId
router.put('/:id/contacts/:contactId', validate(updateContactSchema), async (req: AuthRequest, res, next) => {
  try {
    const list = await prisma.emailList.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!list) return res.status(404).json({ error: 'List not found' });
    const updated = await prisma.contact.update({ where: { id: req.params.contactId }, data: req.body });
    res.json(updated);
  } catch (error) { next(error); }
});

// DELETE /:id/contacts/:contactId
router.delete('/:id/contacts/:contactId', async (req: AuthRequest, res, next) => {
  try {
    await prisma.contact.delete({ where: { id: req.params.contactId } });
    res.json({ message: 'Contact deleted' });
  } catch (error) { next(error); }
});

export default router;
