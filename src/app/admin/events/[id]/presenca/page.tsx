'use client';

import { FadeIn } from '@/components/animations';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { GET_EVENT_BY_SLUG_OR_ID } from '@/lib/queries';
import { useQuery } from '@apollo/client';
import { ArrowLeft, Loader2, Download, Copy, Check, ExternalLink } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

interface AttendanceRecord {
  id: number;
  documentId: string;
  createdAt: string;
  users_permissions_user?: {
    id: number;
    documentId: string;
    name: string;
    email: string;
    phone: string;
    cpf: string;
    date_of_birth: string;
  };
}

const ITEMS_PER_PAGE = 25;
const STRAPI_PAGE_SIZE = 100;

export default function PresencaAdminPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const { data: eventData, loading: eventLoading } = useQuery(
    GET_EVENT_BY_SLUG_OR_ID,
    {
      variables: { slugOrId: id },
      skip: !id,
    }
  );

  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!eventData?.eventBySlugOrId?.documentId) {
      if (!eventLoading) setLoading(false);
      return;
    }

    const fetchAllAttendances = async () => {
      try {
        const eventDocId = eventData.eventBySlugOrId.documentId;
        let allData: AttendanceRecord[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const res = await fetch(
            `https://manager.hubcommunity.io/api/attendances?populate=*&filters[event][documentId][$eq]=${eventDocId}&sort=createdAt:desc&pagination[page]=${page}&pagination[pageSize]=${STRAPI_PAGE_SIZE}`
          );
          if (!res.ok) throw new Error('Falha ao buscar a lista de presença');

          const json = await res.json();
          const data = json.data || [];
          allData = [...allData, ...data];

          const pagination = json.meta?.pagination;
          if (pagination && page < pagination.pageCount) {
            page++;
          } else {
            hasMore = false;
          }
        }

        setAttendances(allData);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Erro desconhecido ao carregar os dados.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAllAttendances();
  }, [eventData, eventLoading]);

  const totalPages = Math.ceil(attendances.length / ITEMS_PER_PAGE);

  const paginatedAttendances = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return attendances.slice(start, start + ITEMS_PER_PAGE);
  }, [attendances, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getVisiblePages = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [1];

    if (currentPage > 3) {
      pages.push('ellipsis');
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push('ellipsis');
    }

    pages.push(totalPages);
    return pages;
  };

  const formatCpf = (cpf: string) => {
    if (!cpf) return '-';
    const clean = cpf.replace(/\D/g, '');
    if (clean.length === 11) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return cpf;
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '-';
    const clean = phone.replace(/\D/g, '');
    if (clean.length >= 10 && clean.length <= 11) {
      return clean.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '--/--/----';
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '--/--/----';
    }
  };

  const handleDownloadXLSX = () => {
    if (attendances.length === 0) return;

    const wsData = attendances.map((a) => {
      const user = a.users_permissions_user;
      return {
        'Nome Completo': user?.name || '-',
        'CPF': user?.cpf ? formatCpf(user.cpf) : '-',
        'E-mail': user?.email || '-',
        'Telefone': user?.phone ? formatPhone(user.phone) : '-',
        'Data de Nascimento': user?.date_of_birth ? formatDate(user.date_of_birth) : '-',
        'Data do Registro': formatDateTime(a.createdAt),
      };
    });

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Presença');
    XLSX.writeFile(
      wb,
      `presenca-${eventData?.eventBySlugOrId?.slug || 'evento'}.xlsx`,
      { bookType: 'xlsx' }
    );
  };

  const handleCopyFormLink = () => {
    const slug = eventData?.eventBySlugOrId?.slug;
    if (!slug) return;
    const url = `${window.location.origin}/attendance/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (eventLoading || (loading && !error)) {
    return (
      <div className="container mx-auto py-10 px-4 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const eventTitle = eventData?.eventBySlugOrId?.title || 'Evento';
  const eventSlug = eventData?.eventBySlugOrId?.slug;

  return (
    <FadeIn direction="up" duration={0.3}>
      <div className="container mx-auto py-10 px-4 max-w-6xl">
        <div className="flex items-center space-x-4 mb-8">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Lista de Presença
            </h1>
            <p className="text-muted-foreground mt-1">{eventTitle}</p>
          </div>
        </div>

        {/* Form Link Card */}
        {eventSlug && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Link do Formulário</CardTitle>
              <CardDescription>
                Compartilhe este link para os participantes assinarem a presença.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/attendance/${eventSlug}`}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyFormLink}
                  title="Copiar link"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(`/attendance/${eventSlug}`, '_blank')}
                  title="Abrir formulário"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attendances Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div>
                <CardTitle>Presenças ({attendances.length})</CardTitle>
                <CardDescription>
                  Lista de pessoas que assinaram a presença neste evento.
                </CardDescription>
              </div>
              {attendances.length > 0 && (
                <Button onClick={handleDownloadXLSX} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar XLSX
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-red-500 bg-red-500/10 p-4 rounded-lg">
                {error}
              </div>
            ) : attendances.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhuma presença registrada ainda.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome Completo</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Data de Nascimento</TableHead>
                        <TableHead>Data do Registro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedAttendances.map((a) => {
                        const user = a.users_permissions_user;

                        return (
                          <TableRow key={a.documentId || a.id}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {user?.name || '-'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {user?.cpf ? formatCpf(user.cpf) : '-'}
                            </TableCell>
                            <TableCell>{user?.email || '-'}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {user?.phone ? formatPhone(user.phone) : '-'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {user?.date_of_birth
                                ? formatDate(user.date_of_birth)
                                : '-'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {formatDateTime(a.createdAt)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                    <p className="text-sm text-muted-foreground">
                      Exibindo{' '}
                      {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                      {Math.min(
                        currentPage * ITEMS_PER_PAGE,
                        attendances.length
                      )}{' '}
                      de {attendances.length} registros
                    </p>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              handlePageChange(currentPage - 1);
                            }}
                            className={
                              currentPage === 1
                                ? 'pointer-events-none opacity-50'
                                : 'cursor-pointer'
                            }
                          />
                        </PaginationItem>

                        {getVisiblePages().map((page, index) =>
                          page === 'ellipsis' ? (
                            <PaginationItem key={`ellipsis-${index}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          ) : (
                            <PaginationItem key={page}>
                              <PaginationLink
                                href="#"
                                isActive={page === currentPage}
                                onClick={(e) => {
                                  e.preventDefault();
                                  handlePageChange(page);
                                }}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        )}

                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              handlePageChange(currentPage + 1);
                            }}
                            className={
                              currentPage === totalPages
                                ? 'pointer-events-none opacity-50'
                                : 'cursor-pointer'
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </FadeIn>
  );
}
