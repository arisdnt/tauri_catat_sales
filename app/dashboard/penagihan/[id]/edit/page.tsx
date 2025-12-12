"use client"

import { useParams } from "next/navigation"
import { PenagihanEditForm } from "./penagihan-edit-form"

export default function EditPenagihanPage() {
    const params = useParams()
    const id = parseInt(params.id as string)

    return <PenagihanEditForm id={id} variant="page" />
}

