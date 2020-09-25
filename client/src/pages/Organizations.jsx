/** ***************************************************************
* Copyright 2020 Advanced Distributed Learning (ADL)
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
**************************************************************** */
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Formik } from 'formik';
import * as Yup from 'yup';

import { useDispatch, useSelector } from 'react-redux';
import { clearOrganizationSearchResults, getOrganizations, requestJoinOrganization, searchOrganizations } from '../actions/organizations';
import PagingTable from '../components/PagingTable';
import { useState } from 'react';

export default function Organizations(props) {
    const dispatch = useDispatch();
    const organizations = useSelector((state) => state.organizations);
    const searchResults = useSelector((state) => state.searchResults.organizations);
    const user = useSelector((state) => state.userData.user);
    const [searchterm, setSearchterm] = useState();
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        dispatch(getOrganizations());
    }, [dispatch]);

    let toDisplay = searchResults || organizations || [];

    let data = React.useMemo(() => toDisplay, [toDisplay]);
    let columns = React.useMemo(() => getColumns(user, (organization, user) => {
        dispatch(requestJoinOrganization(organization.uuid, user));
        setShowModal(true);
        setTimeout(
            () => setShowModal(false),
            3000
        )
    }), [user]);

    const clearSearch = () => {
        dispatch(clearOrganizationSearchResults());
        setSearchterm('')
    }

    return (<>
        <main id="main-content" className="grid-container padding-bottom-4">
            <div className="grid-row display-flex flex-row flex-align-end">
                <div className="grid-col">
                    <h1>Working Groups</h1>
                </div>
                <div className="grid-col display-flex flex-column flex-align-end">
                    <Link
                        to="/organization/create"
                    >
                        <button className="usa-button margin-y-2 margin-right-0">
                            <i className="fa fa-plus margin-right-05"></i>
                            Create Working Group
                        </button>
                    </Link>
                </div>
            </div >
            <div className="grid-row bg-base-lightest">
                <div className="grid-col-12 padding-3">

                    <Formik
                        initialValues={{ search: '', }}
                        validationSchema={Yup.object({
                            search: Yup.string()
                                .required('Required')
                        })}
                        onSubmit={(values, { resetForm }) => {
                            setSearchterm(values.search);
                            dispatch(searchOrganizations(values.search));
                            resetForm({ values: '' })
                        }}
                    >
                        {({
                            values,
                            errors,
                            touched,
                            handleChange,
                            handleBlur,
                            handleSubmit
                        }) => (
                                <form id="search">
                                    <div className="usa-search usa-search--big">
                                        <div role="search" className={`usa-form-group ${errors.search && touched.search ? "usa-form-group--error" : ""}`} style={{ marginTop: '0' }}>
                                            {
                                                errors.search && touched.search && (
                                                    <span className="usa-error-message padding-right-1" role="alert">{errors.search}</span>
                                                )
                                            }
                                            <label className="usa-sr-only" htmlFor="search-field">Search</label>
                                            <input className={`usa-input ${errors.search && touched.search ? "usa-input--error" : ""}`}
                                                id="search-field"
                                                type="search"
                                                name="search"
                                                placeholder="Search for an existing working group"
                                                style={{ maxWidth: "100%", paddingLeft: "1em" }}
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                                value={values.search} />
                                            <button className="usa-button" type="submit" onClick={handleSubmit} style={{ marginTop: 0, paddingLeft: "1em", paddingRight: "1em" }}>
                                                <span className="usa-search__submit-text"
                                                    style={{ whiteSpace: "nowrap", fontSize: "1.15rem", display: "flex", alignItems: "center" }}>Search Working Groups</span>
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            )}
                    </Formik>
                </div>
            </div>

            {
                showModal &&
                <div className="grid-row">
                    <div className="usa-alert usa-alert--info" style={{ width: "100%" }}>
                        <div className="usa-alert__body">
                            <h3 className="usa-alert__heading">Request Sent</h3>
                            <p className="usa-alert__text">Your request to the working group was sent.</p>
                        </div>
                    </div>
                </div>
            }
            <div className="grid-row">
                <PagingTable
                    columns={columns}
                    data={data}
                    emptyMessage="There are no organizations.  You need to create one."
                    searchTerm={searchterm}
                    clearSearch={clearSearch}
                />
            </div>
        </main> </>
    );
}

function getColumns(user, joinAction) {
    const cols = [
        {
            Header: 'Name',
            id: 'name',
            accessor: 'name',
            Cell: function NameLink(
                { cell: { value },
                    cell: { row: { original: { uuid } } } }
            ) {
                return (
                    <Link
                        to={`organization/${uuid}`}
                        className="usa-link button-link"
                    >
                        <span>{value}</span>
                    </Link >
                )
            },
            style: {
                width: '45%'
            }
        },
        {
            Header: 'Profiles',
            accessor: 'profiles.length',
            style: {
                width: '11%',
                textAlign: 'center'
            },
            cellStyle: {
                textAlign: 'center'
            }
        },
        {
            Header: 'Members',
            accessor: 'members.length',
            style: {
                width: '11%',
                textAlign: 'center'
            },
            cellStyle: {
                textAlign: 'center'
            }
        },
        {
            Header: 'Date Created',
            accessor: 'createdOn',
            Cell: ({ cell: { value } }) => value ? (new Date(value)).toLocaleDateString() : "Unknown",
            style: {
                width: '15%',
                textAlign: 'center'
            },
            cellStyle: {
                textAlign: 'center'
            }
        },
        {
            Header: ' ',
            id: 'remove',
            accessor: function removeItem(rowdata) {
                try {
                    if (user) {
                        const orgMember = user && rowdata.members.find(m => m.user && m.user.uuid === user.uuid);
                        return orgMember ? <em>{`(${orgMember.level})`}</em> : <button className="usa-button  usa-button--unstyled" onClick={() => joinAction(rowdata, user)}><span className="text-bold">Join</span></button>;
                    }
                } catch (e) { }
                return "";
            },
            style: {
                width: '11%',
            },
            cellStyle: {
                textAlign: 'center'
            }
        }

    ];

    return cols;
}
